'''
RagV1 Agent Archetype

He is a pitching Assistant capable of answering questions about our documents
using a large language model (LLM) involves integrating a document-processing
pipeline with an LLM API.

Here's an outline of the implementation and a sample Python code using a
framework like `langchain` and OpenAI's GPT models.

The assistant is based on the document:
[Build a Retrieval Augmented Generation (RAG) App: Part 1]
(https://python.langchain.com/docs/tutorials/rag/)
'''

import logging
import os
import re

from dotenv import load_dotenv
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_chroma import Chroma
from langchain.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import START, StateGraph
from typing_extensions import List, TypedDict
import chromadb
import json
from langchain_community.document_loaders import DirectoryLoader
from langchain_community.document_loaders import TextLoader
from langchain_community.document_loaders import WebBaseLoader
from langchain_googledrive.document_loaders import GoogleDriveLoader
from langchain_community.document_loaders import UnstructuredFileIOLoader
from langchain_unstructured import UnstructuredLoader
from langchain_community.vectorstores.utils import filter_complex_metadata
import weaviate
from langchain_weaviate.vectorstores import WeaviateVectorStore

from base_model import init_model, init_embeddings
from xmpp_agent import XmppAgent
from file_manager import FileManager
from helpers import str_to_bool

logger = logging.getLogger("RagV1")

load_dotenv()

# Chroma settings
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")  # host only
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))  # host only
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "agent_{}_rag")  # {} will be replaced by agent name
CHROMA_DIRECTORY = os.getenv("CHROMA_DIRECTORY", "./chroma_db")  # directory only

# Weaviate settings
WEAVIATE_HTTP_HOST = os.getenv("WEAVIATE_HTTP_HOST", "localhost")
WEAVIATE_HTTP_PORT = int(os.getenv("WEAVIATE_HTTP_PORT", "8080"))
WEAVIATE_HTTP_SECURE = str_to_bool(os.getenv("WEAVIATE_HTTP_SECURE", "false"))
WEAVIATE_GRPC_HOST = os.getenv("WEAVIATE_GRPC_HOST", "localhost")
WEAVIATE_GRPC_PORT = int(os.getenv("WEAVIATE_GRPC_PORT", "50051"))
WEAVIATE_GRPC_SECURE = str_to_bool(os.getenv("WEAVIATE_GRPC_SECURE", "false"))

# Google Settings
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
GOOGLE_TOKEN = os.getenv("GOOGLE_TOKEN", "./token.json")


# Define state for application
class State(TypedDict):
  question: str
  context: List[Document]
  answer: str


class RagV1(XmppAgent):
  '''
  RagV1 provides chat based on Retrieval-Augmented Generation
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    self.file_manager = FileManager()

  async def start(self):
    await super().start()

    try:
      # logger.debug(f'self.config: {self.config}')
      # logger.debug(f'self.config.options.rag: {self.config.options.rag}')

      self.regex_get = re.compile(self.config.options.rag.commands["get"])
      self.regex_count = re.compile(self.config.options.rag.commands["count"])
      self.regex_loadText = re.compile(self.config.options.rag.commands["loadText"], re.MULTILINE)
      self.regex_loadURL = re.compile(self.config.options.rag.commands["loadURL"], re.MULTILINE)
      self.regex_loadAttachment = re.compile(self.config.options.rag.commands["loadAttachment"])
      # self.regex_loadGDrive = re.compile(self.config.options.rag.commands["loadGDrive"])
      self.regex_delete = re.compile(self.config.options.rag.commands["delete"])
      logger.debug(f'regex_get: {self.regex_get}')
      logger.debug(f'regex_count: {self.regex_count}')
      logger.debug(f'regex_loadText: {self.regex_loadText}')
      logger.debug(f'regex_loadURL: {self.regex_loadURL}')
      logger.debug(f'regex_loadAttachment: {self.regex_loadAttachment}')
      # logger.debug(f'regex_loadGDrive: {self.regex_loadGDrive}')
      logger.debug(f'regex_delete: {self.regex_delete}')
    except Exception as e:
      logger.error(f"Error initializing commands: {e}")
      await self.slog('error', f"Error initializing commands: {e}")

    # Load LLM and embeddings
    try:
      self.model = init_model(
        model_provider=self.config.options.rag.model.provider,
        model_name=self.config.options.rag.model.name,
        api_key=getattr(self.config.options.rag.model, "apiKey", None),
      )
      logger.debug(f"self.model: {self.model}")
    except Exception as e:
      logger.error(f"Error initializing model: {e}")
      await self.slog('error', f"Error initializing model: {e}")

    try:
      self.embeddings = init_embeddings(
        model_provider=self.config.options.rag.embeddings.provider,
        embeddings_name=self.config.options.rag.embeddings.name,
        api_key=getattr(self.config.options.rag.embeddings, "apiKey", None),
      )
    except Exception as e:
      logger.error(f"Error initializing embeddings model: {e}")
      await self.slog('error', f"Error initializing embeddings model: {e}")

    # Load vector store
    self.vector_store = None
    logger.info(f"Vector store: {self.config.options.rag.vectorStore}")
    if self.config.options.rag.vectorStore == "memory":
      self.vector_store = InMemoryVectorStore(self.embeddings)
    elif self.config.options.rag.vectorStore == "chroma":
      try:
        self.collection_name = CHROMA_COLLECTION.format(self.config.id)
        logger.info(f"chroma collection_name: {self.collection_name}")
        self.chroma_client = chromadb.HttpClient(host=CHROMA_HOST,
                                                 port=CHROMA_PORT)
        self.vector_store = Chroma(client=self.chroma_client,
                                   collection_name=self.collection_name,
                                   embedding_function=self.embeddings)
      except Exception as e:
        logger.error(f"Error creating Chroma client: {e}")
        await self.slog('error', f"Error creating Chroma client: {e}")
        raise e
    elif self.config.options.rag.vectorStore == "chroma-dir":
      try:
        self.collection_name = CHROMA_COLLECTION.format(self.config.id)
        logger.info(f"chroma collection_name: {self.collection_name}")
        self.vector_store = Chroma(persist_directory=CHROMA_DIRECTORY,
                                   collection_name=self.collection_name,
                                   embedding_function=self.embeddings)
      except Exception as e:
        logger.error(f"Error creating Chroma client: {e}")
        await self.slog('error', f"Error creating Chroma client: {e}")
        raise e
    elif self.config.options.rag.vectorStore == "weaviate":
      try:
        weaviate_client = weaviate.connect_to_custom(
          http_host=WEAVIATE_HTTP_HOST,
          http_port=WEAVIATE_HTTP_PORT,
          http_secure=WEAVIATE_HTTP_SECURE,
          grpc_host=WEAVIATE_GRPC_HOST,
          grpc_port=WEAVIATE_GRPC_PORT,
          grpc_secure=WEAVIATE_GRPC_SECURE,
        )
        self.vector_store = WeaviateVectorStore.from_documents([], self.embeddings, client=weaviate_client)  # , tenant=WEAVIATE_TENANT)
      except Exception as e:
        logger.error(f"Error creating Weaviate client: {e}")
        await self.slog('error', f"Error creating Weaviate client: {e}")
        raise e
    else:
      await self.slog('error', f"Unknown vector store: {self.config.options.rag.vectorStore}")
      raise Exception(f"Unknown vector store: {self.config.options.rag.vectorStore}")

    # Document Loaders
    #
    # Example of loaders:
    # loaders: [
    #   { enable: true, kind: "text", files: [ "/opt/app/README.md", "/opt/app/input/tech-docs/raw-features-list.md", "/opt/app/input/tech-docs/tech-development-leading_draft.md" ] },
    #   { enable: true, kind: "directory", path: "/opt/app/input", glob: "**/*.*" },
    #   { enable: true, kind: "web", urls: [ "https://selfdev.vuics.com", "https://en.wikipedia.org/wiki/Agent-based_model" ] },
    #   { enable: true, kind: "google-drive", folderId: "", recursive: true, filesIds: [ "" ], documentIds: [ "1pi95Wc03l8poJoIJpRXniILIPNGIbDn9VMBfmZPdgZY","1PdeQWPP1EZMXCnNNeMAdUhuRQffTbigfKU3bYC3hGjA","12adeT8_7-9ZP7mO205zFlLxU1PjrvtMviV7uwhRunAY","17U3QGlmaKxY_DoXkSZCC5EhSQ7iVehBJSWVifxRpLPo","114agEJugBBjhOoY8Tj0o0tXdntLg94kyGLPmNBemq1A","1DOwKaugogQy-yR9H-rAd-gqPDIfcDV7B3s6orvytKso","1H9OjmYsSJ8Bq2HE4X3bMidranqvkjqP-kLjkcVxQIGA","1zKuMfvQx0Lq_cJgJmzssOZnIHi7hLEpcILsDq7IPOAY","1iJQQ-__EGdsApjFAPJu2c0-raDnCebcXq33UgWL-2CM","1j1_cTw01NUO7tiVWfRADFV2WddZV-ttORupmkMd66vs","16PrhlaVbOqWL-J6N2zKBzKxROICbbf_R7FCoNEmpXac","1RBULCW0TXrYjTL8i9rFcZXu6cvMIkYmJr4cMqf1B9eI","1ozAo6OGcJRj96pk6OXNLCo-cBHT-vZaJ0PEckEAJzUc","1Oq1T9H6EM-XKmQ1FjGTC7SvZRXoz6k1Z1QLBnx6osDY","1lgvjB6RKYviPHC9sgEaCpZc-lbiBTZ1XWEop3Vbq_iQ","1c1cJSqJKJDYj-w8nSWXoc43uFlyNshqDTscMkk-mFuk","1EfDV6cVE4ipe4ZiAFYhFd4jPsCOrYJ-3ENT0wYf1IDk","1882BF98pW90cb5tS-nCyEuOB2eXO7EOTrNJdyykdC3Q","162yIECys1DdLF88jqfMm9kTvt7HoYs47ixPVqxTir94","15JwiNM-28Z9L-ZMvnLaqXd80yxOO9hAmZ6mU87Kk5zA","1MCPlsbmsyTU_h2ehDiqcLSaDOAGoIIJc4KVz7Nh_J9M" ] },
    # ]

    docs = []

    for loader in self.config.options.rag.loaders:
      logger.debug(f"loader: {loader}")
      if not loader.enable:
        continue

      if loader.kind == "text":
        try:
          for file_path in loader.files:
            text_loader = TextLoader(file_path)
            docs_loaded = text_loader.load()
            logger.info(f"TextLoader> documents loaded from {file_path}: {len(docs_loaded)}")
            docs += docs_loaded
        except json.JSONDecodeError as e:
          logger.error(f"Error parsing TEXT_LOADER_FILES JSON: {e}")
        except Exception as e:
          logger.error(f"Error loading text files: {e}")

      if loader.kind == "directory":
        directory_loader = DirectoryLoader(
          loader.path,
          loader.glob,
          show_progress=True,
          use_multithreading=True
        )
        docs_loaded = directory_loader.load()
        logger.info(f"DirectoryLoader> documents loaded: {len(docs_loaded)}")
        docs += docs_loaded

      if loader.kind == "web":
        web_loader = WebBaseLoader(web_paths=tuple(loader.urls))
        docs_loaded = web_loader.load()
        logger.info(f"WebBaseLoader> documents loaded: {len(docs_loaded)}")
        docs += docs_loaded

      if loader.kind == 'google-drive':
        # Enable Google Docs API:
        # https://console.cloud.google.com/apis/api/docs.googleapis.com/metrics
        gdrive_loader = GoogleDriveLoader(
          folder_id=loader.folderId if loader.folderId else None,
          recursive=loader.recursive,
          file_ids=loader.filesIds if loader.filesIds else None,
          document_ids=loader.documentIds if loader.documentIds else None,

          file_loader_cls=UnstructuredFileIOLoader if loader.unstructured else None,
          file_loader_kwargs={"mode": "elements"} if loader.unstructured else None,

          credentials_path=GOOGLE_APPLICATION_CREDENTIALS,
          token_path=GOOGLE_TOKEN,
        )
        docs_loaded = gdrive_loader.load()
        logger.info(f"GoogleDriveLoader> documents loaded: {len(docs_loaded)}")
        docs += docs_loaded

    logger.info(f"Total documents loaded: {len(docs)}")
    await self.slog('info', f"Total documents loaded: {len(docs)}")

    # Retrieval Augmented Generation (RAG)

    if docs:
      self.add_docs(docs)

    self.prompt = ChatPromptTemplate.from_template(self.config.options.rag.systemMessage)
    logger.debug(f"self.prompt: {self.prompt}")

    # Define application steps, compile application and test
    graph_builder = StateGraph(State).add_sequence([self.retrieve, self.generate])
    graph_builder.add_edge(START, "retrieve")
    self.graph = graph_builder.compile()
    logger.info('Graph compiled')
    await self.slog('info', 'Graph compiled')

    await self.slog('debug', 'Agent started')

  def add_docs(self, docs):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    # logger.debug(f"text_splitter: {text_splitter}")
    all_splits = text_splitter.split_documents(docs)
    # logger.debug(f"all_splits: {all_splits}")
    added_ids = self.vector_store.add_documents(documents=all_splits)  # Index chunks
    # logger.debug(f"added_ids: {added_ids}")
    return added_ids

  def retrieve(self, state: State):
    retrieved_docs = self.vector_store.similarity_search(state["question"])
    return {"context": retrieved_docs}

  def generate(self, state: State):
    docs_content = "\n\n".join(doc.page_content for doc in state["context"])
    messages = self.prompt.invoke({"question": state["question"], "context": docs_content})
    response = self.model.invoke(messages)
    return {"answer": response.content}

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")

      if not hasattr(self, 'graph'):
        await self.slog('warn', "Not ready while loading documents")
        raise Exception("Not ready while loading documents")

      if self.file_manager.is_shared_file_url(prompt):
        return self.file_manager.add_file_url(prompt)

      if re.match(self.regex_get, prompt):
        logger.debug("get command")
        get_data = self.vector_store._collection.get()
        return json.dumps(get_data)

      elif re.match(self.regex_count, prompt):
        logger.debug("count command")
        count_data = self.vector_store._collection.count()
        return json.dumps(count_data)

      elif match := re.search(self.regex_loadText, prompt):
        logger.debug("loadText command")
        text = match.group(1)
        logger.debug(f"Parsed text: {text}")
        doc = Document(page_content=text, metadata={"source": "loadText command"})
        logger.debug(f"doc: {doc}")
        added_ids = self.add_docs([doc])
        logger.debug(f"added_ids: {added_ids}")
        return f"Loaded {len(added_ids)} chunks"

      elif match := re.search(self.regex_loadURL, prompt):
        logger.debug("loadURL command")
        arguments = match.group(1)
        logger.debug(f"arguments: {arguments}")
        urls = [url.strip() for url in arguments.split(',')]
        logger.debug(f"urls: {urls}")
        web_loader = WebBaseLoader(web_paths=tuple(urls))
        docs = web_loader.load()
        logger.debug(f"docs: {docs}")
        added_ids = self.add_docs(docs)
        logger.debug(f"added_ids: {added_ids}")
        return f"Loaded {len(added_ids)} chunks"

      elif re.match(self.regex_loadAttachment, prompt):
        logger.debug("loadAttachment command")
        file_urls = self.file_manager.get_file_urls()
        logger.debug(f"file_urls: {file_urls}")
        files_iobytes = self.file_manager.get_files_iobytes()
        # logger.debug(f"files_iobytes: {files_iobytes}")
        docs = []
        for file_iobytes, url in zip(files_iobytes, file_urls):
          # logger.debug(f"file_iobytes: {file_iobytes}")
          # logger.debug(f"url: {url}")
          filename = self.file_manager.get_filename_from_url(url)
          # logger.debug(f"filename: {filename}")
          file_iobytes.seek(0)
          loader = UnstructuredLoader(
            file=file_iobytes,
            url=url,
            metadata_filename=filename,
          )
          # logger.debug(f"loader: {loader}")
          loaded_docs = loader.load()
          filtered_docs = filter_complex_metadata(loaded_docs)
          docs.extend(filtered_docs)
        # logger.debug(f"docs: {docs}")
        added_ids = self.add_docs(docs)
        self.file_manager.clear()
        # logger.debug(f"added_ids: {added_ids}")
        return f"Loaded {len(added_ids)} chunks"

      # elif re.match(self.regex_loadGDrive, prompt):
      #   logger.debug("loadGDrive command")
      #   return ''

      elif re.match(self.regex_delete, prompt):
        logger.debug("delete command")
        doc_count = self.vector_store._collection.count()
        logger.debug(f"Deleting {doc_count} documents from vector store...")

        logger.debug("Deleting all documents from vector store...")
        # result = await self.vector_store.adelete(where={})
        get_data = self.vector_store._collection.get()
        logger.debug(f"get_data: {get_data}")
        all_ids = get_data["ids"]
        logger.debug(f"all_ids: {all_ids}")
        result = self.vector_store.delete(ids=all_ids)
        # result = self.vector_store._client.delete_collection(self.vector_store._collection.name)
        logger.debug(f"delete result: {result}")
        doc_count = self.vector_store._collection.count()
        logger.info(f"Documents in vector store now: {doc_count}")
        return 'Deleted'

      response = self.graph.invoke({"question": prompt})
      logger.debug(f"answer: {response['answer']}")
      return response["answer"]

    except Exception as e:
      logger.error(f"rag error: {e}")
      await self.slog('error', f"rag error: {e}")
      return f"Error: {str(e)}"
