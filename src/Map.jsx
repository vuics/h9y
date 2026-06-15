import React, {
  useState, useRef, useEffect, useCallback, createContext, useContext,
  Fragment, memo,
} from 'react'
import axios from 'axios'
import * as SemanticUiReact from 'semantic-ui-react'
import {
  Container,
  Loader,
  Message,
  Button,
  Input,
  Icon,
  Card,
  Dropdown,
  Accordion,
  Checkbox,
  Modal,
  Popup,
  Menu,
  Sidebar,
  Label,
  Grid,
  Segment,
  // Header,
} from 'semantic-ui-react'
import ReactECharts from "echarts-for-react";
import TextareaAutosize from "react-textarea-autosize";
import {
  ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState,
  addEdge, Panel, SelectionMode, useReactFlow, ReactFlowProvider, Handle,
  Position, BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType,
  useNodesData, NodeResizer, useNodesInitialized,
  // reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { faker } from '@faker-js/faker'
import { nanoid } from 'nanoid'
import Dagre from '@dagrejs/dagre';

import CodeMirror from '@uiw/react-codemirror';
import { vim } from '@replit/codemirror-vim';
import { mentions } from '@uiw/codemirror-extensions-mentions'
import { loadLanguage, langNames } from '@uiw/codemirror-extensions-langs'
import {
  abcdef, abyss, androidstudio, andromeda, atomone, aura, basicLight,
  basicDark, bbedit, bespin, consoleLight, consoleDark, copilot, duotoneLight,
  duotoneDark, darcula, dracula, eclipse, githubLight, githubDark,
  gruvboxLight, gruvboxDark, kimbie, materialLight, materialDark, monokai,
  monokaiDimmed, noctisLilac, nord, okaidia, quietlight, red, solarizedLight,
  solarizedDark, sublime, tokyoNight, tokyoNightStorm, tokyoNightDay,
  vscodeLight, vscodeDark, whiteLight, whiteDark, tomorrowNightBlue,
  xcodeLight, xcodeDark,
} from '@uiw/codemirror-themes-all'
import { useTranslation } from 'react-i18next'
import i18n from "i18next";

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import CodeMirrorMerge from 'react-codemirror-merge';
import { EditorView } from 'codemirror';
import { EditorState } from '@codemirror/state';

import UiwMarkdownEditor from '@uiw/react-markdown-editor'
import mermaid from "mermaid";
import { getCodeString } from "rehype-rewrite";

import Form from '@rjsf/semantic-ui'
import validator from '@rjsf/validator-ajv8';
import { JsonEditorField } from './Hive'
import stringify from 'json-stringify-pretty-compact';

import { MDXProvider } from '@mdx-js/react'
import * as runtime from 'react/jsx-runtime'
import { compile } from '@mdx-js/mdx'

import { GraphicWalker } from '@kanaries/graphic-walker';

import Menubar from './components/Menubar'
import conf, { bool } from './conf'
import { useWindowDimensions, sleep, hexToRgba } from './helper.js'
import { MarkdownMermaid } from './components/Text'
import { texturePattern } from './components/patterns'
import { useIndexContext } from './components/IndexContext'

import { useXmppContext } from './components/XmppContext'
import {
  unameRegex, ucommentRegex, variableOrCommentRegex,
  buildSmartText, checkCondition, unlinkEdge,
  createOnChatMessage,
  playEdge, playMapCore,
} from './maptor'
import Data from './Data'

const editorThemes = {
  'default': 'light',
  '-': '',
  'light': 'light',
  'dark': 'dark',
  '--': '',
  'abcdef': abcdef,
  'abyss': abyss,
  'androidstudio': androidstudio,
  'andromeda': andromeda,
  'atomone': atomone,
  'aura': aura,
  'basic-light': basicLight,
  'basic-dark': basicDark,
  'bbedit': bbedit,
  'bespin': bespin,
  'console-light': consoleLight,
  'console-dark': consoleDark,
  'copilot': copilot,
  'duotone-light': duotoneLight,
  'duotone-dark': duotoneDark,
  'darcula': darcula,
  'dracula': dracula,
  'eclipse': eclipse,
  'github-light': githubLight,
  'github-dark': githubDark,
  'gruvbox-light': gruvboxLight,
  'gruvbox-dark': gruvboxDark,
  'kimbie': kimbie,
  'material-light': materialLight,
  'material-dark': materialDark,
  'monokai': monokai,
  'monokai-dimmed': monokaiDimmed,
  'noctis-lilac': noctisLilac,
  'nord': nord,
  'okaidia': okaidia,
  'quietlight': quietlight,
  'red': red,
  'solarized-light': solarizedLight,
  'solarized-dark': solarizedDark,
  'sublime': sublime,
  'tokyo-night': tokyoNight,
  'tokyo-night-storm': tokyoNightStorm,
  'tokyo-night-day': tokyoNightDay,
  'vscode-light': vscodeLight,
  'vscode-dark': vscodeDark,
  'white-light': whiteLight,
  'white-dark': whiteDark,
  'tomorrow-night-blue': tomorrowNightBlue,
  'xcode-light': xcodeLight,
  'xcode-dark': xcodeDark,
}

const MapContext = createContext({});
const useMapContext = () => useContext(MapContext);

const ExpandingVariable = memo(({ part, allNodes, color, backgroundColor }) => {
  const { fitView } = useReactFlow();
  const [ active, setActive ] = useState(false)

  let uname = part
  let ucomment = ''
  let foundNodes = []
  let nodeText
  let match = part.match(unameRegex);
  // console.log('match:', match)
  if (match) {
    uname = match[1]
  } else {
    match = part.match(ucommentRegex);
    if (match) {
      uname = match[1]
      ucomment = match[1]
    }
  }

  foundNodes = allNodes.filter((n) => n.data.uname === uname);
  if (foundNodes.length === 1) {
    nodeText = foundNodes[0].data.text
  } else {
    console.warn('ExpandingVariable> foundNodes for part:', part, 'do not consist of exactly one node, foundNodes:', foundNodes)
    nodeText = '((Not found))'
  }

  return (
    <Accordion fluid styled style={{
      color,
      backgroundColor,
    }} >
      <Accordion.Title
        style={{
          color: !ucomment ? color : hexToRgba({ hexColor: color, alpha: 0.5 }),
        }}
        styled
        active={active}
        index={0}
        onClick={((e) => {
          e.stopPropagation();
          setActive(active => !active)
        })}
      >
        <Icon name={!!ucomment ? 'eye slash outline' : (active ? 'triangle down' : 'triangle right')} />
        {uname}
        {' '}{' '}{' '}{' '}
        <Icon
          color='grey'
          name='linkify'
          onClick={(e => {
            e.stopPropagation();
            fitView({ nodes: foundNodes, duration: 1000 });
          })}
        />
      </Accordion.Title>
      { !ucomment && (
        <Accordion.Content active={active}>
          <pre style={{ overflow: 'auto' }}>
            {nodeText}
          </pre>
        </Accordion.Content>
      )}
    </Accordion>
  )
})

const DiffEditor = memo(({ text, setText, stash, setStash, data }) => {
  const { editorTheme } = useMapContext();

  const extensions = [
    EditorView.editable.of(false),
    EditorState.readOnly.of(true)
  ]
  if (!data.kind || data.kind === 'markdown') {
    extensions.push(markdown({ base: markdownLanguage, codeLanguages: languages }))
  } else if (data.kind !== 'raw' && data.lang) {
    extensions.push(loadLanguage(data.lang))
  }

  return (<>
    <CodeMirrorMerge
      orientation='a-b'
      revertControls={ data.editing ? 'b-to-a' : 'a-to-b' }
      highlightChanges={true}
      gutter={true}
      theme={editorThemes[editorTheme]}
      destroyRerender={false}  // it can update text only with destroyRerender
    >
      <CodeMirrorMerge.Original
        value={text}
        onChange={setText}
        extensions={extensions}
      />
      <CodeMirrorMerge.Modified
        value={stash}
        onChange={setStash}
        extensions={extensions}
      />
    </CodeMirrorMerge>
  </>)
})

const CodeEditor = memo(({ text, setText, roster, data, id, setNodes }) => {
  const { editorTheme, vimMode, viewerTheme } = useMapContext();
  const extensions = []
  extensions.push(mentions(roster.map(({ name }) => { return { label: `@${name}` }})))
  if (vimMode) {
    extensions.push(vim())
  }
  if (!data.kind || data.kind === 'markdown') {
    extensions.push(markdown({ base: markdownLanguage, codeLanguages: languages }))
  } else if (data.kind !== 'raw' && data.lang) {
    extensions.push(loadLanguage(data.lang))
  }

  const startEditing = ({ id, data, setNodes }) => {
    console.log('startEditing')
    if (!data.editing) {
      console.log('startEditing: update nodes')
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, editing: !data.editing } } : node
      ))
    }
  }

  // console.log('editorTheme:', editorTheme, ', vimMode:', vimMode, ', viewerTheme:', viewerTheme)
  return (<>
    <CodeMirror
      value={text}
      onChange={setText}
      editable={!!data.editing}
      readOnly={!data.editing}
      basicSetup={{
        syntaxHighlighting: (data.kind !== 'raw' && data.lang),
        highlightActiveLine: false,

        lineNumbers: !!data.editing,
        foldGutter: !!data.editing,
        autocompletion: !!data.editing,
        closeBrackets: !!data.editing,
        bracketMatching: !!data.editing,
        indentOnInput: !!data.editing,
        highlightSpecialChars: !!data.editing,
        history: !!data.editing,
        drawSelection: !!data.editing,
        allowMultipleSelections: !!data.editing,
        rectangularSelection: !!data.editing,
        highlightSelectionMatches: !!data.editing,
        dropCursor: !!data.editing,
        crosshairCursor: !!data.editing,
        closeBracketsKeymap: !!data.editing,
        defaultKeymap: !!data.editing,
        searchKeymap: !!data.editing,
        historyKeymap: !!data.editing,
        foldKeymap: !!data.editing,
        completionKeymap: !!data.editing,
        lintKeymap: !!data.editing,
      }}
      theme={data.editing ? editorThemes[editorTheme] : editorThemes[viewerTheme] }
      extensions={extensions}
      onClick={() => startEditing({ id, data, setNodes })}
      className="nodrag nopan"
    />
  </>)
})

const randomid = () => parseInt(String(Math.random() * 1e15), 10).toString(36);

const Code = ({ children = [], className, ...props }) => {
  const demoid = useRef(`dome${randomid()}`);
  const [container, setContainer] = useState(null);
  const isMermaid =
    className && /^language-mermaid/.test(className.toLocaleLowerCase());
  const code = children
    ? getCodeString(props.node.children)
    : children[0] || "";

  useEffect(() => {
    if (container && isMermaid && demoid.current && code) {
      mermaid
        .render(demoid.current, code)
        .then(({ svg, bindFunctions }) => {
          console.log("svg:", svg);
          container.innerHTML = svg;
          if (bindFunctions) {
            bindFunctions(container);
          }
        })
        .catch((error) => {
          console.log("error:", error);
        });
    }
  }, [container, isMermaid, code, demoid]);

  const refElement = useCallback((node) => {
    if (node !== null) {
      setContainer(node);
    }
  }, []);

  if (isMermaid) {
    return (
      <Fragment>
        <code id={demoid.current} style={{ display: "none" }} />
        <code className={className} ref={refElement} data-name="mermaid" />
      </Fragment>
    );
  }
  return <code className={className}>{children}</code>;
};

const switchEditing = ({ id, data, setNodes }) => {
  console.log('switchEditing')
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, editing: !data.editing } } : node
    )
  );
}

const NoteViewer = memo(({ data, allNodes, setNodes, id, text }) => {
  return (<>
    <div
      onClick={() => switchEditing({ id, data, setNodes })}
      style={{ cursor: 'pointer' }}
    >
      {text.split(variableOrCommentRegex).map((part, i) => {
        if (variableOrCommentRegex.test(part)) {
          return (
            <ExpandingVariable
              key={i} part={part} allNodes={allNodes}
              color={data.color}
              backgroundColor={data.backgroundColor}
            />
          )
        } else {
          return (
            <MarkdownMermaid key={i}>{part}</MarkdownMermaid>
          )
        }
      })}
    </div>
  </>)
})

const NoteEditor = memo(({
  text, setText, applyText, cancelText, data, allNodes, setNodes, id
}) => {
  if (!data.editing) {
    return (
      <p
        onClick={() => !data.editing && switchEditing({ id, data, setNodes })}
      >
        {text}
      </p>
    );
  }

  return (<>
    <TextareaAutosize
      value={text}
      onChange={(e) => {
        setText(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) {
          e.preventDefault();
          applyText()
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelText()
        }
      }}
      className="nodrag"
      minRows={6}
      // maxRows={12}
      style={{
        width: '100%',
        height: '100%',
        color: data.color || '',
        backgroundColor: data.backgroundColor || '',
      }}
    />
  </>)
})

const MarkdownEditor = memo(({
  text, setText, data, allNodes, setNodes, id, roster, applyText, cancelText,
}) => {
  const { markdownEditor } = useMapContext();

  if (!data.editing) {
    return (
      <NoteViewer
        data={data} allNodes={allNodes} setNodes={setNodes} id={id} text={text}
      />
    )
  }

  if (markdownEditor === 'markdown' || markdownEditor === 'markdown-dark') {
    return (
      <div data-color-mode={ markdownEditor === 'markdown' ? "light" : "dark" }>
        <div className="wmde-markdown-var"> </div>
        <UiwMarkdownEditor
          value={text}
          onChange={(value) => setText(value)}
          height="100%"
          enableScroll={true}
          // toolbars={[
          //   'undo', 'redo', 'bold', 'italic', 'header', 'strike', 'underline',
          //   'quote', 'olist', 'ulist', 'todo', 'link', 'image', 'code', 'codeBlock',
          // ]}
          toolbarsMode={[
            'preview'
          ]}
          previewProps={{
            components: {
              code: Code
            }
          }}
        />
      </div>
    )
  }

  if (markdownEditor === 'code-preview') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', width: '100%', height: '100%' }}>
        <div style={{ flex: 1, width: '50%' }}>
          <CodeEditor
            text={text} setText={setText} roster={roster} data={data}
            id={id} setNodes={setNodes}
          />
        </div>
        <div style={{ flex: 1, width: '50%'  }}>
          <NoteViewer
            data={data} allNodes={allNodes} setNodes={setNodes} id={id} text={text}
          />
        </div>
      </div>
    )
  }


  if (markdownEditor === 'text-area') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', width: '100%', height: '100%' }}>
        <div style={{ flex: 1, width: '50%' }}>
          <NoteEditor
            text={text} setText={setText}
            applyText={applyText} cancelText={cancelText} data={data}
            allNodes={allNodes} setNodes={setNodes} id={id}
          />
        </div>
      </div>
    )
  }

  return (
    <CodeEditor
      text={text} setText={setText} roster={roster} data={data}
      id={id} setNodes={setNodes}
    />
  )
})

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an external service here
    console.error("Error in child component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ color: 'red' }}>Something went wrong: {this.state.error?.message}</div>;
    }

    return this.props.children;
  }
}

const FormEditor = memo(({ text, setText, id, setNodes, roster, data, cancelText }) => {
  const { t } = useTranslation('Map')
  const [ changed, setChanged ] = useState(false)

  const [ formObj, setFormObj ] = useState({})
  const [ errorMessage, setErrorMessage ] = useState(null)

  useEffect(() => {
    try {
      const formObj = JSON.parse(text)
      setFormObj(formObj)
    } catch (err) {
      setErrorMessage({
        header: 'Error parsing the form JSON',
        body: err.toString(),
      })
    }
  }, [text])

  if (data.editing) {
    return (
      <CodeEditor
        text={text} setText={setText} roster={roster} data={data}
        id={id} setNodes={setNodes}
      />
    )
  }

  if (errorMessage) {
    return (
      <Message negative>
        <Message.Header>
          {errorMessage.header}
        </Message.Header>
        <p>
          {errorMessage.body}
        </p>
      </Message>
    )
  }

  return (
    <Segment secondary>
      <Form
        schema={formObj.schema || {}}
        uiSchema={formObj.uiSchema || {}}
        formData={formObj.formData || {}}
        fields={{ JsonEditorField }}
        validator={validator}
        onSubmit={({ formData }) => {
          const clonedObj = Object.assign({}, { ...formObj, formData })
          const text = stringify(clonedObj)
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id ? { ...node, data: {
                ...node.data,
                text,
              } } : node
            )
          );
          setChanged(false)
        }}
        onChange={() => setChanged(true)}
        // onChange={log('changed')}
        // onError={log('errors')}
      >
        <Button.Group>
          <Button
            type='button'
            onClick={() => { cancelText(); setChanged(false) }}
            disabled={!changed}
          >
            <Icon name='cancel' />
            {' '}
            {t('Cancel')}
            {' '}
          </Button>
          <Button.Or />
          <Button
            type='submit' positive on
            disabled={!changed}
          >
            <Icon name='save' />
            {' '}
            {t('Submit')}
            {' '}
          </Button>
        </Button.Group>
      </Form>
    </Segment>
  )
})


export const MdxViewer = ({ text, setText, roster, data, id, setNodes }) => {
  const components = {
    ...SemanticUiReact,
    ReactECharts,
    ExternalButtonExample: (props) => <button {...props} style={{ color: 'violet' }} />,
  }

  const [Compiled, setCompiled] = useState(() => () => <div>Compiling...</div>)

  useEffect(() => {
    if (data.editing) {
      return
    }
    // TODO: compile in worker
    //      Take care of security
    //      https://mdxjs.com/docs/getting-started/#security
    compile(text, { outputFormat: 'function-body' })
      .then((file) => {
        const { default: MDXContent } = new Function(String(file))(runtime)
        setCompiled(() => MDXContent)
      })
      .catch((err) => {
        setCompiled(() => () => <pre style={{ color: 'red' }}>{err.message}</pre>)
      })
  }, [text, data.editing])

  if (data.editing) {
    return (
      <CodeEditor
        text={text} setText={setText} roster={roster} data={data}
        id={id} setNodes={setNodes}
      />
    )
  }

  return (
    <ErrorBoundary>
      <MDXProvider>
        <Compiled components={components} />
      </MDXProvider>
    </ErrorBoundary>
  )
}

const DataViewer = ({ text, setText, roster, data, id, setNodes }) => {
  // const { t } = useTranslation('Map')
  // const [ changed, setChanged ] = useState(false)

  const [ dataObj, setDataObj ] = useState({})
  const [ errorMessage, setErrorMessage ] = useState(null)

  useEffect(() => {
    try {
      const dataObj = JSON.parse(text)
      setDataObj(dataObj)
    } catch (err) {
      setErrorMessage({
        header: 'Error parsing the data JSON',
        body: err.toString(),
      })
    }
  }, [text])

  useEffect(() => {
    if (data.editing) {
      return
    }
  }, [text, data.editing])

  if (data.editing) {
    return (
      <CodeEditor
        text={text} setText={setText} roster={roster} data={data}
        id={id} setNodes={setNodes}
      />
    )
  }

  if (errorMessage) {
    return (
      <Message negative>
        <Message.Header>
          {errorMessage.header}
        </Message.Header>
        <p>
          {errorMessage.body}
        </p>
      </Message>
    )
  }

  console.log('data:', dataObj.data)
  console.log('fields:', dataObj.fields)

  return (
    <ErrorBoundary>
      { (dataObj?.data?.length > 0 && dataObj?.fields?.length > 0) && (
        <GraphicWalker
          className="nodrag nopan"
          data={dataObj.data || {}}
          fields={dataObj.fields || {}}
          i18nLang={i18n.language}
        />
      )}
    </ErrorBoundary>
  )
}


const ApplyOrCancel = memo(({ applyText, cancelText }) => {
  const { t } = useTranslation('Map')
  return (
    <Button.Group floated='right'>
      <Button
        compact positive
        icon labelPosition='left'
        onClick={applyText}
      >
        <Icon name='check' />
        {t('Apply')}
      </Button>
      <Button.Or />
      <Button
        compact
        icon labelPosition='right'
        onClick={cancelText}
      >
        <Icon name='cancel' />
        {t('Cancel')}
      </Button>
    </Button.Group>
  )
})

const NoteNode = memo(({ id, data, isConnectable, selected }) => {
  const { t } = useTranslation('Map')
  const { user } = useIndexContext()
  const { getNodes, setNodes, getEdges, setEdges, fitView } = useReactFlow();
  const [ newUname, setNewUname ] = useState(data.uname)
  const {
    presence, roster, setCurrentSlide, attachFile, xmppClient,
  } = useMapContext();
  const [ text, setText ] = useState(data.text)
  const [ stash, setStash ] = useState(data.stash || '')
  const attachFileInputRef = useRef(null);
  const [ attaching, setAttaching ] = useState(false)
  const [ dataModal, setDataModal ] = useState(false)

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const allNodes = getNodes()
  // console.log('id:', id, ', data.text:', data.text, ', text:', text, ', setText:', setText)
  // console.log('presence:', presence)
  // console.log('roster:', roster)

  useEffect(() => {
    setNewUname(data.uname);
  }, [data.uname]);

  useEffect(() => {
    setText(data.text);
  }, [data.text]);

  useEffect(() => {
    setStash(data.stash || '');
  }, [data.stash]);

  const applyText = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, text, stash, editing: false } } : node
      )
    )
  }, [setNodes, text, stash, id])

  const cancelText = useCallback(() => {
    setText(data.text)
    setStash(data.stash)
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, editing: false } } : node
      )
    )
  }, [setText, data.text, setStash, data.stash, setNodes, id])

  const renameUname = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, renaming: !data.renaming} } : node
      )
    );
  }, [setNodes, data.renaming, id])

  const applyNewUname = useCallback(() => {
    let isDuplicate = false
    setNodes((nodes) => {
      isDuplicate = nodes.some((node) => node.id !== id && node.data.uname === newUname);
      if (isDuplicate) { alert('The name is not unique'); return nodes; }
      const updatedNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, uname: newUname, renaming: false } } : node
      );

      getEdges().forEach((edge) => {
        if(edge.source === id) {
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === edge.target ? { ...node, data: { ...node.data,
                text: node.data.text.replace(`[[${data.uname}]]`, `[[${newUname}]]`).replace(`[/*[${data.uname}]*/]`, `[/*[${newUname}]*/]`) }
              } : node
            )
          )
        }
      });
      setEdges((edges) =>
        edges.map((edge) =>
          edge.data.evaluateOn === data.uname ? { ...edge, data: { ...edge.data, evaluateOn: newUname } } : edge
        )
      )
      return updatedNodes
    });
  }, [setNodes, getEdges, data.uname, newUname, id])

  const cancelNewUname = useCallback(() => {
    setNodes((nodes) => {
      return nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, renaming: false } } : node);
    });
    setNewUname(data.uname);
  }, [setNodes, data.uname, id, setNewUname])

  const copyText = useCallback(async () => {
    try {
      const smartText = buildSmartText({ text, getNodes })
      await navigator.clipboard.writeText(smartText)
      // alert('Text copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text, getNodes])

  const pasteText = useCallback(async () => {
    try {
      const pastedText = await navigator.clipboard.readText()
      // console.log('pastedText:', pastedText)
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, text: pastedText } } : node
        )
      )
    } catch (err) {
      console.error('Paste failed:', err);
    }
  }, [setNodes, id])

  const selectKind = (kind) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, kind } } : node
      )
    )
  }

  const selectLang = (lang) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, lang } } : node
      )
    )
  }

  const makeSlide = useCallback((slide) => {
    // Some nodes may already have slideIndex values, but what if they're
    // inconsistent (e.g. gaps, duplicates, or mixed with undefined),
    // you'll want to normalize all existing slideIndexes first,
    // then assign the new one cleanly.
    setNodes((nodes) => {
      // Step 1: Extract and normalize all existing slides
      const slides = nodes
        .filter(n => n.data?.slide)
        .sort((a, b) => (a.data.slideIndex ?? 0) - (b.data.slideIndex ?? 0))
        .map((n, i) => ({ ...n, data: { ...n.data, slideIndex: i } }));

      // Step 2: Build a map for normalized slide indexes
      const slideMap = Object.fromEntries(slides.map(n => [n.id, n]));

      const slideIndex = slide ? slides.length : undefined
      if (slideIndex) {
        setCurrentSlide(slideIndex)
      }

      // Step 3: Update all nodes
      return nodes.map((n) => {
        const isTarget = n.id === id;
        // If this is the node being updated
        if (isTarget) {
          return { ...n, data: { ...n.data, slide, slideIndex, }, };
        }
        // Else, normalize existing slide nodes
        return slideMap[n.id] ?? n;
      });
    });
  }, [setNodes, id, setCurrentSlide]);

  const reorderSlide = useCallback((direction) => {
    setNodes((nodes) => {
      // Step 1: Normalize slideIndexes
      const slides = nodes
        .filter(n => n.data?.slide)
        .sort((a, b) => (a.data.slideIndex ?? 0) - (b.data.slideIndex ?? 0))
        .map((n, i) => ({ ...n, data: { ...n.data, slideIndex: i } }));

      const index = slides.findIndex(n => n.id === id);
      const swapIndex = index + direction;

      if (index === -1 || swapIndex < 0 || swapIndex >= slides.length) return nodes;

      // Swap slideIndexes
      const slideA = slides[index];
      const slideB = slides[swapIndex];
      setCurrentSlide(swapIndex)

      const updatedNodes = nodes.map((n) => {
        if (n.id === slideA.id) {
          return { ...n, data: { ...n.data, slideIndex: slideB.data.slideIndex } };
        }
        if (n.id === slideB.id) {
          return { ...n, data: { ...n.data, slideIndex: slideA.data.slideIndex } };
        }
        return n;
      });

      return updatedNodes;
    });
  }, [id, setNodes, setCurrentSlide]);

  const getTotalSlides = useCallback(() => {
    return allNodes.filter(node => node.data?.slide === true).length;
  }, [allNodes])

  const attachFileInit = () => {
    // console.log('user:', user)
    attachFileInputRef.current.click(); // triggers hidden input
  };

  const onFileInputChange = async (event) => {
    try {
      setAttaching(true)
      const fileUrl = await attachFile(event)
      console.log('fileUrl:', fileUrl)
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: {
            ...node.data,
            attachments: [...(node.data.attachments || []), fileUrl]
          } } : node
        )
      );
    } catch (err) {
      console.error('Error attaching file:', err);
    } finally {
      setAttaching(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Audio tracks:', stream.getAudioTracks()); // Debug log
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const contentType = 'audio/webm;codecs=opus';
          const audioBlob = new Blob(audioChunksRef.current, { type: contentType });
          const filename = `recording-${Date.now()}.webm`;
          const buffer = await audioBlob.arrayBuffer();
          const recordingUrl = await xmppClient.uploadFile({
            buffer,
            filename,
            size: audioBlob.size,
            contentType,
            shareHost: conf.xmpp.shareHost,
          });
          console.log('Uploaded recording url:', recordingUrl);
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id ? { ...node, data: {
                ...node.data,
                text: node.data.text + `\n<audio controls><source src="${recordingUrl}" type="${contentType}" />Your browser does not support the audio element.</audio>`,
                attachments: [...(node.data.attachments || []), recordingUrl],
              } } : node
            )
          );
        } catch (err) {
          console.error('Error on stopping and uploading recording:', err);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Microphone access failed:', error);
      alert(t('Microphone access denied or not available.'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // NOTE: The code hides the resizeObserver error
  useEffect(() => {
    const errorHandler = (e) => {
      if (e.message.includes("ResizeObserver loop completed with undelivered notifications") ||
         e.message.includes("ResizeObserver loop limit exceeded")) {
        const resizeObserverErr = document.getElementById("webpack-dev-server-client-overlay");
        if (resizeObserverErr) {
          resizeObserverErr.style.display = "none";
        }
      }
    };
    window.addEventListener("error", errorHandler);
    return () => {
      window.removeEventListener("error", errorHandler);
    };
  }, []);

  return (
    <Card
      style={{
        width: '100%',
        height: '100%',
        borderStyle: selected ? 'solid' : undefined,
        borderColor: selected ? 'violet' : undefined,
        backgroundColor: data.backgroundColor,
        color: data.color,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="a"
        isConnectable={isConnectable}
        style={{ width: '1em', height: '0.75em', background: '#bbb' }}
      />
      <Card.Header
        style={{
          padding: '0.5em 1em 0.5em 1em',
        }}
      >
        <Dropdown item simple position='right'
          icon={
            <Icon size='large' name='ellipsis vertical' color='grey' />
          }>
          <Dropdown.Menu>
            <Dropdown.Item
              onClick={copyText}
            >
              <Icon name='copy' />
              {t('Copy')}
            </Dropdown.Item>
            <Dropdown.Item
              onClick={pasteText}
            >
              <Icon name='paste' />
              {t('Paste')}
            </Dropdown.Item>

            <Dropdown.Divider />

            <Dropdown.Item
              onClick={renameUname}
            >
              <Icon name='i cursor' />
              {t('Rename')}
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => {
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.id === id ? { ...node, data: { ...node.data, editing: !data.editing } } : node
                  )
                );
              }}
            >
              <Icon name='edit' />
              { data.editing ? t('View') : t('Edit') }
            </Dropdown.Item>
            <Dropdown.Item
              onClick={attachFileInit}
              disabled={user?.limits?.fileAttachments != null && !user.limits.fileAttachments}
            >
              <Icon name='attach' />
              {t('Attach file')}
              <input
                type="file"
                // accept="application/json"
                ref={attachFileInputRef}
                onChange={onFileInputChange}
                style={{ display: 'none' }} // hide input
              />
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setDataModal(true)}
              disabled={user?.limits?.fileAttachments != null && !user.limits.fileAttachments}
            >
              <Icon name='disk' />
              {t('Insert Data')}
            </Dropdown.Item>
            { dataModal && (
              <Modal
                onClose={() => setDataModal(false)}
                open={dataModal}
                size='fullscreen'
              >
                <Modal.Header>
                  {t('Insert Data')}
                </Modal.Header>
                <Modal.Content scrolling>
                  <Data
                    hideMenubar
                    clickFile = {(file) => {
                      console.log('file:', file)
                      const fileUrl = `${conf.xmpp.shareUrlPrefix}${file.slot}/${file.filename}`;
                      console.log('fileUrl:', fileUrl)
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id ? { ...node, data: {
                            ...node.data,
                            attachments: [...(node.data.attachments || []), fileUrl]
                          } } : node
                        )
                      );
                      setDataModal(false)
                    }}
                    clickStorage = {(storage) => {
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id ? { ...node, data: {
                            ...node.data,
                            // uname: node.data.uname += storage.key,
                            text: node.data.text += storage.value,
                            editing: false,
                          } } : node
                        )
                      );
                      setDataModal(false)
                    }}
                  />
                </Modal.Content>
                <Modal.Actions>
                  <Button onClick={() => setDataModal(false)}>
                    {t('Cancel')}
                  </Button>
                </Modal.Actions>
              </Modal>
            )}

            <Dropdown.Item
              onClick={recording ? stopRecording : startRecording}
              disabled={user?.limits?.audioRecordings != null && !user.limits.audioRecordings}
            >
              <Icon name={ recording ? 'microphone slash' : 'microphone' } />
              {recording ? t('Stop Recording') : t('Record Audio') }
            </Dropdown.Item>
            <Dropdown text={t('Diff')} pointing='left' className='link item'>
              <Dropdown.Menu>

                { data.diffing && (<>
                  <Dropdown.Item
                    onClick={() => {
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id ? { ...node, data: { ...node.data, diffing: !data.diffing } } : node
                        )
                      );
                    }}
                  >
                    <Icon name='window close outline' />
                    {t('Close diff')}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                </>) }

                { (!data.diffing || data.editing) && (<>
                  <Dropdown.Item
                    onClick={() => {
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id ? { ...node, data: { ...node.data, diffing: true, editing: false } } : node
                        )
                      );
                    }}
                  >
                    <Icon name='caret square right outline' />
                    {t('Diff stash (view)')}
                  </Dropdown.Item>
                </>) }
                { (!data.diffing || !data.editing) && (<>
                  <Dropdown.Item
                    onClick={() => {
                      setNodes((nodes) =>
                        nodes.map((node) =>
                          node.id === id ? { ...node, data: { ...node.data, diffing: true, editing: true } } : node
                        )
                      );
                    }}
                  >
                    <Icon name='caret square left outline' />
                    {t('Diff restore (edit)')}
                  </Dropdown.Item>
                </>) }

                <Dropdown.Divider />
                <Dropdown.Item
                  onClick={() => {
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id ? { ...node, data: { ...node.data, stash: text, stashAttachments: node.data.attachments } } : node
                      )
                    );
                  }}
                >
                  <Icon name='long arrow alternate right' />
                  {t('Stash content')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => {
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id ? { ...node, data: { ...node.data, text: stash, attachments: node.data.stashAttachments  } } : node
                      )
                    );
                  }}
                >
                  <Icon name='long arrow alternate left' />
                  {t('Restore content')}
                </Dropdown.Item>

                <Dropdown.Divider />
                <Dropdown.Item
                  onClick={() => {
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id ? { ...node, data: { ...node.data, stash: '', stashAttachments: undefined } } : node
                      )
                    );
                  }}
                >
                  <Icon name='erase' />
                  {t('Clear stash')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            <Dropdown.Divider />

            <Dropdown text={t('Note kind')} pointing='left' className='link item'>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => selectKind(undefined)}>
                  <Icon name={ !data.kind ? 'dot circle' : 'circle outline'} />
                  {t('Plain note')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => selectKind('markdown')}>
                  <Icon name={ (data.kind === 'markdown') ? 'dot circle' : 'circle outline'} />
                  {t('Markdown')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => selectKind('code')}>
                  <Icon name={ data.kind === 'code' ? 'dot circle' : 'circle outline'} />
                  {t('Code')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => selectKind('raw')}>
                  <Icon name={ data.kind === 'raw' ? 'dot circle' : 'circle outline'} />
                  {t('Raw')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => selectKind('form')}>
                  <Icon name={ data.kind === 'form' ? 'dot circle' : 'circle outline'} />
                  {t('Form')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => selectKind('mdx')}>
                  <Icon name={ data.kind === 'mdx' ? 'dot circle' : 'circle outline'} />
                  {t('MDX / HTML')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => selectKind('data')}>
                  <Icon name={ data.kind === 'data' ? 'dot circle' : 'circle outline'} />
                  {t('Data Analysis')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            <Dropdown text={t('Slide')} pointing='left' className='link item'>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => makeSlide(!data.slide)}>
                  <Icon name={ data.slide ? 'toggle on' : 'toggle off'} />
                  { data.slide ? t('Remove from slides') : t('Add to slides') }
                </Dropdown.Item>
                { data.slide && (<>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => setCurrentSlide(data.slideIndex)}>
                    <Icon name='hand pointer outline' />
                    {t('Activate slide')}:
                    {data.slideIndex + 1} / {getTotalSlides()}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => reorderSlide(1)}>
                    <Icon name='long arrow alternate up' />
                    {t('Move slide up')}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => reorderSlide(-1)}>
                    <Icon name='long arrow alternate down' />
                    {t('Move slide down')}
                  </Dropdown.Item>
                </>)}
              </Dropdown.Menu>
            </Dropdown>

            <Dropdown text={t('Programming language')} pointing='left' className='link item'>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => { selectLang(undefined); selectKind('raw') } }>
                  <Icon name={ !data.lang ? 'dot circle' : 'circle outline'} />
                  {t('(None)')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => { selectLang('python'); selectKind('code') } }>
                  <Icon name={ data.lang === 'python' ? 'dot circle' : 'circle outline'} />
                  {t('Python')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => { selectLang('javascript'); selectKind('code') } }>
                  <Icon name={ data.lang === 'javascript' ? 'dot circle' : 'circle outline'} />
                  {t('JavaScript')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => { selectLang('json'); selectKind('code') } }>
                  <Icon name={ data.lang === 'json' ? 'dot circle' : 'circle outline'} />
                  {t('JSON')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => { selectLang('yaml'); selectKind('code') } }>
                  <Icon name={ data.lang === 'yaml' ? 'dot circle' : 'circle outline'} />
                  {t('YAML')}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => { selectLang('html'); selectKind('code') } }>
                  <Icon name={ data.lang === 'html' ? 'dot circle' : 'circle outline'} />
                  {t('HTML')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            <Dropdown text={t('More programming languages')} pointing='left' className='link item'>
              <Dropdown.Menu>
                { langNames.map((lng) => { return (
                  <Dropdown.Item key={lng} onClick={() => { selectLang(lng); selectKind('code') } }>
                    <Icon name={ data.lang === lng ? 'dot circle' : 'circle outline'} />
                    {lng}
                  </Dropdown.Item>
                ) } ) }
              </Dropdown.Menu>
            </Dropdown>

            <Dropdown.Divider />

            <Dropdown.Item
              onClick={() => {
                setNodes((nodes) => nodes.filter((n) => n.id !== id));
              }}
            >
              <Icon name='delete' />
              {t('Delete')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        { !data.renaming? (
          <Button
            size='mini'
            onClick={renameUname}
          >
            <Icon name='pin' />
            {data.uname}
          </Button>
        ) : (
          <>
          <Input
            size='large'
            iconPosition='left'
            placeholder={t('Unique name...')}
            value={newUname}
            onChange={(e) => setNewUname(e.target.value)}
            className="nodrag"
          >
            <Icon name='pin' />
            <input
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyNewUname()
                }
                if (e.key === 'Escape') {
                  cancelNewUname()
                }
              }}
            />
          </Input>
          {' '}
          <Button.Group>
            <Button icon positive onClick={applyNewUname} >
              <Icon name='check' />
            </Button>
            <Button.Or />
            <Button icon onClick={cancelNewUname}>
              <Icon name='cancel'/>
            </Button>
          </Button.Group>
          </>
        ) }
        <Button.Group floated='right'>
          <Button
            icon compact basic
            size='mini'
            onClick={() => {
              setNodes((nodes) =>
                nodes.map((node) =>
                  node.id === id ? {
                    ...node,
                    width: data.minimized ? 600 : 350,
                    data: { ...node.data, minimized: !data.minimized }
                  } : node
                )
              )
            }}
          >
            <Icon
              name={data.minimized ? 'window maximize outline' : 'window minimize outline'}
              color={data.minimized ? 'blue' : 'grey'}
            />
          </Button>
          <Button
            icon compact basic
            size='mini'
            onClick={() => {
              setTimeout(() => {
                // NOTE: fitView is deferred to ensure layout is up to date
                fitView({ nodes: getNodes().filter(n => n.id === id), duration: 1000 });
              }, 0);
            }}
          >
            <Icon name='crosshairs' color='grey' />
          </Button>
        </Button.Group>
      </Card.Header>
      { !data?.minimized && (<>
        <Card.Content>
          <Loader active={!!data.waitRecipient} inline='centered' size='mini' />
          { data.waitRecipient && (
            <>
              <br />
              {t('Waiting for a reply from')}
              :{' '}
              <Label as='a' basic color='grey'>
                <Icon name='user' color={ presence[data.waitRecipient] ? 'green' : 'red' }/>
                {(roster.find(r => r.jid === data.waitRecipient))?.name || data.waitRecipient}
                <Icon
                  name='delete'
                  onClick={(e) => {
                    e.preventDefault(); // Prevent opening the link when clicking the icon
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id ? { ...node, data: {
                          ...node.data,
                          waitRecipient: undefined,
                        } } : node
                      )
                    );
                  }}
                  style={{ marginLeft: '1em', cursor: 'pointer' }}
                />
              </Label>
            </>
          ) }

          { data.diffing ? (<>
            <DiffEditor
              text={text} setText={setText} stash={stash} setStash={setStash}
              data={data} setNodes={setNodes} id={id}
            />
          </>) : (<>
            { !data.kind && (<>
              <NoteEditor
                text={text} setText={setText}
                applyText={applyText} cancelText={cancelText} data={data}
                allNodes={allNodes} setNodes={setNodes} id={id}
              />
            </>)}

            { data.kind === 'markdown' && (<>
              <MarkdownEditor
                text={text} setText={setText}
                applyText={applyText} cancelText={cancelText} data={data}
                allNodes={allNodes} setNodes={setNodes} id={id} roster={roster}
              />
            </>)}

            { (data.kind === 'code' || data.kind === 'raw') && (<>
              <CodeEditor
                text={text} setText={setText} roster={roster} data={data}
                id={id} setNodes={setNodes}
              />
            </>)}

            { data.kind === 'form' && (<>
              <FormEditor
                text={text} setText={setText} id={id} setNodes={setNodes}
                roster={roster} data={data} cancelText={cancelText}
              />
            </>)}

            { data.kind === 'mdx' && (<>
              <MdxViewer
                text={text} setText={setText} roster={roster} data={data}
                id={id} setNodes={setNodes}
              />
            </>)}

            { data.kind === 'data' && (<>
              <DataViewer
                text={text} setText={setText} roster={roster} data={data}
                id={id} setNodes={setNodes}
              />
            </>)}
          </>)}

          { data.editing && (<>
            <br/>
            <ApplyOrCancel applyText={applyText} cancelText={cancelText} />
          </>)}
        </Card.Content>
        { ((data.attachments && data.attachments.length > 0)
            || (data.diffing && data.stashAttachments && data.stashAttachments.length > 0)
            || attaching) && (
          <Card.Content>
            {attaching && (
              <Loader active={attaching}  size='tiny' inline='centered' />
            )}

            <Grid divided='vertically'>
              <Grid.Row columns={data.diffing ? 2 : 1}>
                <Grid.Column>
                  {data.attachments?.map((url, index) => (
                    <Label
                      key={index}
                      as='a'
                      href={url}
                      target='_blank'
                      rel='noopener noreferrer'
                      basic
                      color='grey'
                    >
                      <Icon name='attach' />
                      {url.split('/').pop()}
                      <Icon
                        name='delete'
                        onClick={(e) => {
                          e.preventDefault(); // Prevent opening the link when clicking the icon
                          setNodes((nodes) =>
                            nodes.map((node) =>
                              node.id === id ? { ...node, data: {
                                ...node.data,
                                attachments: (node.data.attachments || []).filter((item) => item !== url),
                              } } : node
                            )
                          );
                        }}
                        style={{ marginLeft: '1em', cursor: 'pointer' }}
                      />
                    </Label>
                  ))}
                </Grid.Column>
                { data.diffing && (
                  <Grid.Column>
                    {data.stashAttachments?.map((url, index) => (
                      <Label
                        key={index}
                        as='a'
                        href={url}
                        target='_blank'
                        rel='noopener noreferrer'
                        basic
                        color='grey'
                      >
                        <Icon name='attach' />
                        {url.split('/').pop()}
                        <Icon
                          name='delete'
                          onClick={(e) => {
                            e.preventDefault(); // Prevent opening the link when clicking the icon
                            setNodes((nodes) =>
                              nodes.map((node) =>
                                node.id === id ? { ...node, data: {
                                  ...node.data,
                                  stashAttachments: (node.data.stashAttachments || []).filter((item) => item !== url),
                                } } : node
                              )
                            );
                          }}
                          style={{ marginLeft: '1em', cursor: 'pointer' }}
                        />
                      </Label>
                    ))}
                  </Grid.Column>
                )}
              </Grid.Row>
            </Grid>
          </Card.Content>
        )}
      </>)}

      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        isConnectable={isConnectable}
        style={{ width: '1em', height: '0.75em', background: '#aaa' }}
      />
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={100}
        minHeight={30}
        onResizeEnd={() => {
          console.log('onResizeEnd')
          setNodes((nodes) =>
            nodes.map((node) =>
              // Make the proper sizing. Allow dynamic change of heigth.
              node.id === id ? { ...node, height: undefined } : node
            )
          )
        }}
      />
    </Card>
  );
})

const GroupNode = memo(({ id, data, style, selected }) => {
  const { t } = useTranslation('Map')
  const { setNodes, getEdges } = useReactFlow();
  const [ newUname, setNewUname ] = useState(data.uname)
  // console.log('id:', id, ', data.text:', data.text, ', text:', text, ', setText:', setText)

  useEffect(() => {
    setNewUname(data.uname);
  }, [data.uname]);

  const renameUname = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, renaming: !data.renaming} } : node
      )
    );
  }, [setNodes, data.renaming, id])

  const applyNewUname = useCallback(() => {
    let isDuplicate = false
    setNodes((nodes) => {
      isDuplicate = nodes.some((node) => node.id !== id && node.data.uname === newUname);
      if (isDuplicate) { alert(t('The name is not unique')); return nodes; }
      const updatedNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, uname: newUname, renaming: false } } : node
      );
      return updatedNodes
    });
  }, [setNodes, getEdges, data.uname, newUname, id])

  const cancelNewUname = useCallback(() => {
    setNodes((nodes) => {
      return nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, renaming: false } } : node);
    });
    setNewUname(data.uname);
  }, [setNodes, data.uname, id, setNewUname])

  const toggleAnd = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, and: !node.data.and } } : node
      )
    )
  }, [setNodes, id])

  const toggleActivation = useCallback(() => {
    if (data.deactivated) {
      // activate
      setNodes((nodes) =>
        nodes.map((node) =>
          node.deactivatedParentId === id && !node.extent
            ? { ...node,
                parentId: node.deactivatedParentId,
                deactivatedParentId: undefined,
                extent: 'parent',
              }
            : node
        ).map((node) => node.id === id
          ? { ...node,
              data: { ...node.data, deactivated: undefined },
              width: node.deactivatedWidth,
              height: node.deactivatedHeight,
              deactivatedWidth: undefined,
              deactivatedHeight: undefined,
            }
          : node
        )
      )
    } else {
      // deactivate
      setNodes((nodes) =>
        nodes.map((node) =>
          node.parentId === id && node.extent === 'parent'
            ? { ...node,
                deactivatedParentId: node.parentId,
                parentId: undefined,
                extent: undefined,
              }
            : node
        ).map((node) => node.id === id
          ? { ...node,
              data: { ...node.data, deactivated: true },
              deactivatedWidth: node.width,
              deactivatedHeight: node.height,
              width: 600,
              height: 300,
            }
          : node
        )
      )
    }
  }, [setNodes, id, data.deactivated])

  // NOTE: The code hides the resizeObserver error
  // useEffect(() => {
  //   const errorHandler = (e: any) => {
  //     if (e.message.includes("ResizeObserver loop completed with undelivered notifications" || "ResizeObserver loop limit exceeded")) {
  //       const resizeObserverErr = document.getElementById("webpack-dev-server-client-overlay");
  //       if (resizeObserverErr) {
  //         resizeObserverErr.style.display = "none";
  //       }
  //     }
  //   };
  //   window.addEventListener("error", errorHandler);
  //   return () => {
  //     window.removeEventListener("error", errorHandler);
  //   };
  // }, []);

  // console.log('group style:', style)
  return (
    <Card
      style={{
        ...style,
        width: '100%',
        height: '100%',
        borderStyle: selected ? 'solid' : undefined,
        borderColor: selected ? 'violet' : undefined,
        backgroundColor: hexToRgba({ hexColor: data.backgroundColor, alpha: 0.03 }),
        color: data.color,
        // pointerEvents: 'none',
        // zIndex: '1',
      }}
    >
      <Card.Header
        style={{
          padding: '0.5em 1em 0.5em 1em',
          backgroundColor: hexToRgba({ hexColor: data.backgroundColor, alpha: selected ? 1 : 0.3 }),
        }}
      >
        <Dropdown item simple position='right'
          icon={
            <Icon size='large' name='ellipsis vertical' color='grey' />
          }>
          <Dropdown.Menu>
            <Dropdown.Item
              onClick={renameUname}
            >
              <Icon name='i cursor' />
              {t('Rename')}
            </Dropdown.Item>
            <Dropdown.Item
              onClick={toggleAnd}
            >
              <Icon name='tasks' />
              {t('Toggle Loop Exit Operator')}
              :{' '}
              { data.and ? t('OR') : t('AND') }
            </Dropdown.Item>
            <Dropdown.Item
              onClick={toggleActivation}
            >
              <Icon name={data.deactivated ? 'plus circle' : 'minus circle'} />
              {data.deactivated ? t('Activate') : t('Deactivate')}
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => {
                setNodes((nodes) =>
                  nodes.map((node) =>
                    node.parentId === id ? { ...node, parentId: undefined, extent: undefined, } : node
                  ).filter((n) => n.id !== id)
                )
              }}
            >
              <Icon name='delete' />
              {t('Delete')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        { !data.renaming? (
          <Button
            basic
            onClick={renameUname}
          >
            <Icon name='object group outline' />{data.uname}
          </Button>
        ) : (
          <>
          <Input
            size='large'
            iconPosition='left'
            placeholder={t('Unique name...')}
            value={newUname}
            onChange={(e) => setNewUname(e.target.value)}
            className="nodrag"
          >
            <Icon name='object group outline' />
            <input
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyNewUname()
                }
                if (e.key === 'Escape') {
                  cancelNewUname()
                }
              }}
            />
          </Input>
          {' '}
          <Button.Group>
            <Button icon positive onClick={applyNewUname} >
              <Icon name='check' />
            </Button>
            <Button.Or />
            <Button icon onClick={cancelNewUname} >
              <Icon name='cancel' />
            </Button>
          </Button.Group>
          </>
        ) }
        {' '}
        <Button
          basic
          onClick={toggleAnd}
        >
          <Icon name='tasks' />
          {data.and ? t('AND') : t('OR') }
        </Button>
        {/*
        <Loader active={true} inline='centered' size='mini' />
        */}
      </Card.Header>
      <Card.Content
        style={{
          backgroundColor: hexToRgba({ hexColor: data.backgroundColor, alpha: 0.03 }),
        }}
        className='nodrag nopan'
      >
      </Card.Content>
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
      />
    </Card>
  );
})

const OrderControl = memo(({ id, expecting, sequence, cursor, reordering }) => {
  const { setEdges } = useMapContext();

  const moveEdge = useCallback(({ step }) => {
    setEdges((edges) => {
      const index = edges.findIndex(edge => edge.id === id);
      if (index === -1) return edges; // Edge not found
      const newIndex = index + step
      if (newIndex < 0 || newIndex >= edges.length) return edges; // Out of bounds
      const updatedEdges = [...edges];
      const [movedEdge] = updatedEdges.splice(index, 1); // Remove the edge
      updatedEdges.splice(newIndex, 0, movedEdge); // Insert at new position

      let sequence = 1
      return updatedEdges.map((edge) => ({
        ...edge, data: { ...edge.data, sequence: sequence++ }
      }));
    });
  }, [id, setEdges])

  return (
    <>
    { reordering && (
      <Button compact size='mini' onClick={() => { moveEdge({ step: -1 }) }} >
        <Icon name='caret down' />
      </Button>
    )}
    { sequence && (
      <Button color={ cursor ? 'olive' : (expecting ? 'yellow' : (reordering ? 'blue' : 'green')) }>
        [{sequence}]:{' '}
      </Button>
    )}
    { reordering && (
      <Button compact size='mini' onClick={() => { moveEdge({ step: 1 }) }} >
        <Icon name='caret up' />
      </Button>
    )}
    </>
  )
})

const RequestEdge = memo(({
  id, data, source, target, style, selected,
  sourceX, sourceY, targetX, targetY, markerEnd,
}) => {
  const { t } = useTranslation('Map')
  const { setNodes, getNodes, fitView } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  const { presence, roster } = useMapContext();
  const [ sourceNode, targetNode ] = useNodesData([source, target])
  // console.log('sourceNode:', sourceNode, ', targetNode:', targetNode)
  const {
    recipient, condition, reordering, orderEdges, setEdges, getEdges,
    xmppClient,
  } = useMapContext();
  const [ searchUname, setSearchUname ] = useState('')

  const updateCondition = useCallback(({ condition }) => {
    let evaluateOnNode = null
    if (data.evaluateOn) {
      evaluateOnNode = getNodes().find(n => n.data.uname === data.evaluateOn)
    }
    // console.log('text:', evaluateOnNode ? evaluateOnNode.data.text : sourceNode.data.text)
    const smartText = buildSmartText({
      text: evaluateOnNode ? evaluateOnNode.data.text : sourceNode.data.text,
      getNodes
    })
    // console.log('smartText:', smartText)
    const [ satisfied, safe ] = checkCondition({ condition: data.condition, text: smartText })
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id ? { ...edge, data: { ...edge.data, condition, satisfied, safe } } : edge
      )
    )
    return { satisfied, safe }
  })

  const setEvaluateOn = useCallback(({ uname }) => {
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id ? { ...edge, data: { ...edge.data, evaluateOn: uname } } : edge
      )
    )
  }, [setEdges, id])

  useEffect(() => {
    updateCondition({ condition: data.condition })
  }, [data.condition, data.evaluateOn]) // NOTE: do not add updateCondition to dependencies

  return (
    <>
      <BaseEdge
        id={id} path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: data.stroke,
          strokeWidth: selected ? 3 : 1,
        }}
      />
      <EdgeLabelRenderer>
        <Button.Group icon compact size='mini'
          className='nodrag nopan'
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <OrderControl
            id={id}
            expecting={data.expecting}
            sequence={data.sequence}
            cursor={data.cursor}
            reordering={reordering}
          />

          <Button
            compact
            size='mini'
            onClick={async () => {
              console.log('source:', source, ', target:', target)
              await playEdge({
                sourceNodeData: sourceNode.data, edgeData: data,
                getNodes, setNodes, getEdges, setEdges,
                xmppClient,
                edgeId: id, targetId: targetNode.id,
              })
            }}
          >
            <Icon
              name={ data.recipient ? 'user' : 'sync'}
              color={ data.recipient ? (presence[data.recipient] ? 'green' : 'red' ) : 'grey' }
            />
            {(roster.find(r => r.jid === data.recipient))?.name || data.recipient}
          </Button>

          { data.condition && (
            <Button
              compact
              size='mini'
              onClick={() => {
                const { satisfied, safe } = updateCondition({ condition: data.condition })
                window.alert(`Condition "${data.condition}" has been ${ satisfied !== null ? (satisfied ? 'satisfied' : 'unsatisfied') : 'unknown'}. The regular expression is ${ safe !== null ? (safe ? 'safe' : 'unsafe') : 'unknown' }.`);
              }}
            >
              { data.safe !== null && (
                <Icon
                  color={ data.satisfied ? 'green' : 'red' }
                  name={ data.safe ? 'usb' : 'warning sign' }
                />
              )}
              {data.condition}
            </Button>
          )}
          { data.evaluateOn && (
            <Button
              compact
              size='mini'
              onClick={() => {
                setTimeout(() => {
                  // NOTE: fitView is deferred to ensure layout is up to date
                  fitView({ nodes: getNodes().filter(n => n.data.uname === data.evaluateOn), duration: 1000 });
                }, 0);
              }}
            >
              <Icon
                name='sticky note outline'
                color={ data.satisfied ? 'green' : 'red' }
              />
              {data.evaluateOn}
            </Button>
          )}

          <Button compact size='mini'>
            <Dropdown item simple position='right'
              icon={
               <Icon name='ellipsis vertical' color='grey' />
              }>
              <Dropdown.Menu>
                <Dropdown.Item
                  onClick={() => {
                    setEdges((edges) =>
                      edges.map((edge) =>
                        edge.id=== id ? { ...edge, data: { ...edge.data, recipient }, animated: undefined } : edge
                      )
                    );
                  }}
                >
                  <Icon name='user plus' />
                  {t('Set recipient')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => {
                    setEdges((edges) =>
                      edges.map((edge) =>
                        edge.id=== id ? { ...edge, data: { ...edge.data, recipient: undefined }, animated: true } : edge
                      )
                    );
                  }}
                >
                  <Icon name='remove user' />
                  {t('Unset recipient')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => {
                    updateCondition({ condition })
                  }}
                >
                  <Icon name='usb' />
                  {t('Set condition')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => {
                    updateCondition({ condition: '' })
                  }}
                >
                  <Icon name='eraser' />
                  {t('Unset condition')}
                </Dropdown.Item>

                <Dropdown.Item
                  // onClick={() => { }}
                >
                  <Icon name='sticky note' />
                  {t('Evaluate Condition On')}
                  <Icon name='dropdown' />
                    <Dropdown.Menu>
                      <Dropdown.Item
                        onClick={() => setEvaluateOn({ uname: undefined })}
                        disabled={!data.evaluateOn}
                      >
                        { !data.evaluateOn && (<>
                          {sourceNode.data.uname} (default)
                        </>)}
                        { data.evaluateOn && (<>
                          <Icon name='erase' />
                          {data.evaluateOn}
                        </>)}
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Header content='Search a Note' />
                      <Input
                        icon='search' iconPosition='left' name='search'
                        value={searchUname}
                        onChange={e => setSearchUname(e.target.value)}
                      />
                      { getNodes()
                          .filter(n => !searchUname || n.data.uname.includes(searchUname))
                          .map(n => (
                            <Dropdown.Item key={n.data.uname}
                              text={n.data.uname}
                              onClick={() => setEvaluateOn({ uname: n.data.uname })}
                            />
                          ))
                          // .slice(0, 10)
                      }
                    </Dropdown.Menu>
                </Dropdown.Item>

                <Dropdown.Item onClick={orderEdges}>
                  <Icon name='sort' />
                  {t('Reorder')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => {
                    setEdges((es) => es.filter((e) => {
                      if (e.id === id) {
                        unlinkEdge({ edge: e, getNodes, setNodes })
                      }
                      return e.id !== id
                    }));
                  }}
                >
                  <Icon name='unlinkify' />
                  {t('Unlink')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => {
                    setEdges((es) => es.filter((e) => e.id !== id));
                  }}
                >
                  <Icon name='delete' />
                  {t('Delete')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Button>

        </Button.Group>
      </EdgeLabelRenderer>
    </>
  );
})

const nodeTypes = {
  NoteNode: NoteNode,
  group: GroupNode,
};

const edgeTypes = {
  RequestEdge: RequestEdge,
  VariableEdge: RequestEdge, // NOTE: Deprecated but for compatibility
};

const getNodeId = () => nanoid(9)
const getUname = (id) => `Note_${id}`
const getUgroup = (id) => `Loop_${id}`


const getLayoutedElements = (nodes, edges, options) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: options.direction });
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    }),
  );
  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - (node.measured?.width ?? 0) / 2;
      const y = position.y - (node.measured?.height ?? 0) / 2;
      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

const defaultColor = '#000000'
const defaultBackgroundColor = '#ffffff'
const defaultStroke = '#999999'
const hiddenConfirm = {
  open: false,
  header: 'Confirm',
  message: 'Are you sure?',
  func: () => {},
}

function Map () {
  const { t } = useTranslation('Map')
  const { height, width } = useWindowDimensions();
  const [ loading, setLoading ] = useState(true)
  const [ responseError, setResponseError ] = useState('')
  const [ responseMessage, setResponseMessage ] = useState('')
  const [ prompt, setPrompt ] = useState('')
  // const [ room, setRoom ] = useState('matrix')
  const [ maps, setMaps ] = useState([])
  const [ title, setTitle ] = useState('example-map')
  const [ renaming, setRenaming ] = useState(false)
  const [ opener, setOpener ] = useState(false)
  const [ openerSearch, setOpenerSearch ] = useState('')
  const [ color, setColor ] = useState(defaultColor)
  const [ backgroundColor, setBackgroundColor ] = useState(defaultBackgroundColor)
  const [ stroke, setStroke ] = useState(defaultStroke)
  const [ confirm, setConfirm ] = useState(hiddenConfirm)
  const fileInputRef = useRef(null);

  const [ reordering, setReordering ] = useState(false)
  const [ playing, setPlaying ] = useState(false)
  const [ stepping, setStepping ] = useState(false)
  const [ pausing, setPausing ] = useState(false)
  const playingRef = useRef(playing)
  const steppingRef = useRef(stepping)
  const pausingRef = useRef(pausing)
  playingRef.current = playing
  steppingRef.current = stepping
  pausingRef.current = pausing

  const [ currentSlide, setCurrentSlide ] = useState(-1)
  const [ deckSidebar, setDeckSidebar ] = useState(false)

  const reactFlowWrapper = useRef(null);
  const [ nodes, setNodes, onNodesChange ] = useNodesState([]);
  const [ edges, setEdges, onEdgesChange ] = useEdgesState([]);
  const {
    screenToFlowPosition, flowToScreenPosition,
    getViewport, setViewport, fitView,
    getNodes, getEdges, getNode,
  } = useReactFlow();
  const [ rfInstance, setRfInstance ] = useState(null);

  const [ recipientSearch, setRecipientSearch ] = useState('')
  const [ recipient, setRecipient ] = useState(() => {
    return localStorage.getItem('map.recipient') || ''
  })
  useEffect(() => {
    localStorage.setItem('map.recipient', recipient);
  }, [recipient]);

  const [ condition, setCondition ] = useState(() => {
    return localStorage.getItem('map.condition') || ''
  })
  useEffect(() => {
    localStorage.setItem('map.condition', condition);
  }, [condition]);

  const [ mapId, setMapId ] = useState(() => {
    return localStorage.getItem('map.mapId') || ''
  })
  useEffect(() => {
    localStorage.setItem('map.mapId', mapId);
  }, [mapId]);

  const [ autosave, setAutosave ] = useState(() => {
    const saved = localStorage.getItem('map.autosave')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.autosave', autosave.toString());
  }, [autosave]);

  const [ showMenu, setShowMenu ] = useState(() => {
    const saved = localStorage.getItem('map.showMenu') || true
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('map.showMenu', showMenu.toString());
  }, [showMenu]);

  const [ showOpener, setShowOpener ] = useState(() => {
    const saved = localStorage.getItem('map.showOpener')
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('map.showOpener', showOpener.toString());
  }, [showOpener]);

  const [ showMinimap, setShowMinimap ] = useState(() => {
    const saved = localStorage.getItem('map.showMinimap')
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('map.showMinimap', showMinimap.toString());
  }, [showMinimap]);

  const [ showPanel, setShowPanel ] = useState(() => {
    const saved = localStorage.getItem('map.showPanel')
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('map.showPanel', showPanel.toString());
  }, [showPanel]);

  const [ showColors, setShowColors ] = useState(() => {
    const saved = localStorage.getItem('map.showColors')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.showColors', showColors.toString());
  }, [showColors]);

  const [ showFile, setShowFile ] = useState(() => {
    const saved = localStorage.getItem('map.showFile')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.showFile', showFile.toString());
  }, [showFile]);

  const [ showExecution, setShowExecution ] = useState(() => {
    const saved = localStorage.getItem('map.showExecution')
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('map.showExecution', showExecution.toString());
  }, [showExecution]);

  const [ showLayout, setShowLayout ] = useState(() => {
    const saved = localStorage.getItem('map.showLayout')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.showLayout', showLayout.toString());
  }, [showLayout]);

  const [ showSlides, setShowSlides ] = useState(() => {
    const saved = localStorage.getItem('map.showSlides')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.showSlides', showSlides.toString());
  }, [showSlides]);

  const [ showPrompt, setShowPrompt ] = useState(() => {
    const saved = localStorage.getItem('map.showPrompt')
    return saved !== null ? bool(saved) : true
  })
  useEffect(() => {
    localStorage.setItem('map.showPrompt', showPrompt.toString());
  }, [showPrompt]);

  const [ promptInput, setPromptInput ] = useState(() => {
    const saved = localStorage.getItem('map.promptInput')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.promptInput', promptInput.toString());
  }, [promptInput]);

  const [ editorTheme, setEditorTheme ] = useState(() => {
    return localStorage.getItem('map.editorTheme') || 'default'
  })
  useEffect(() => {
    localStorage.setItem('map.editorTheme', editorTheme);
  }, [editorTheme]);

  const [ viewerTheme, setViewerTheme ] = useState(() => {
    return localStorage.getItem('map.viewerTheme') || 'default'
  })
  useEffect(() => {
    localStorage.setItem('map.viewerTheme', viewerTheme);
  }, [viewerTheme]);

  const [ vimMode, setVimMode ] = useState(() => {
    const saved = localStorage.getItem('map.vimMode')
    return saved !== null ? bool(saved) : false
  })
  useEffect(() => {
    localStorage.setItem('map.vimMode', vimMode);
  }, [vimMode]);

  const [ markdownEditor, setMarkdownEditor ] = useState(() => {
    return localStorage.getItem('map.markdownEditor') || 'text-area'
  })
  useEffect(() => {
    localStorage.setItem('map.markdownEditor', markdownEditor);
  }, [markdownEditor]);


  const { xmppClient } = useXmppContext()
  const [ roster, setRoster ] = useState([])
  const [ presence, setPresence ] = useState({});
  // console.log('presence:', presence)
  // console.log('roster:', roster)
  const onChatMessageRef = useRef(null);
  if (!onChatMessageRef.current) {
    onChatMessageRef.current = createOnChatMessage({
      getNodes, setNodes, shareUrlPrefix: conf.xmpp.shareUrlPrefix,
    });
  }
  useEffect(() => {
    if (!xmppClient?.emitter || !onChatMessageRef.current) return;
    setRoster(xmppClient.roster)
    setPresence(xmppClient.presence)
    xmppClient.emitter.on('roster', setRoster)
    xmppClient.emitter.on('presence', setPresence)
    xmppClient.emitter.on('chatMessage', onChatMessageRef.current);
    xmppClient.emitter.on('online', () => setLoading(false))
    xmppClient.emitter.on('error', (err) => {
      setLoading(false);
      setResponseError(`XMPP error: ${err}`);
    })
    xmppClient.emitter.on('close', () => setLoading(false))
    return () => {
      xmppClient.emitter.removeListener('chatMessage', onChatMessageRef.current);
      xmppClient.emitter.removeListener('roster', setRoster)
      xmppClient.emitter.removeListener('presence', setPresence)
    }
  }, [xmppClient]);

  // console.log('credentials:', credentials)
  // console.log('presence:', presence)
  // console.log('roster:', roster)
  // console.log('autosave:', autosave)
  // console.log('nodes:', nodes)
  // console.log('title:', title)
  // console.log('condition:', condition)
  // console.log('openerSearch:', openerSearch)
  // console.log('color:', color, 'backgroundColor:', backgroundColor)

  const getMap = useCallback((mapId) => {
    return maps.filter(({ _id }) => _id === mapId)[0]
  }, [maps])

  const indexMaps = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/map?skip=${conf.map.skip}&limit=${conf.map.limit}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('maps index res:', res)
      setMaps(res?.data || [])
      if (res?.data?.length >= 1) {
        let index = 0
        if (mapId) {
          index = res?.data.findIndex(map => map._id === mapId)
          if (index < 0) { index = 0 }
        }
        setMapId(res?.data[index]?._id)
        setTitle(res?.data[index]?.title)
        setNodes(res?.data[index]?.flow.nodes);
        setEdges(res?.data[index]?.flow.edges);
        setViewport(res?.data[index]?.flow.viewport);
      }
    } catch (err) {
      console.error('indexMaps error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting maps.'))
    } finally {
      setLoading(false)
    }
  }, [setLoading, setMaps, setMapId, setTitle, setNodes, setEdges, setViewport, setResponseError, t])

  useEffect(() => {
    indexMaps()
  }, [indexMaps])

  const postMap = useCallback(async ({ duplicate = false } = {}) => {
    setLoading(true)
    try {
      if (!rfInstance) {
        throw new Error('ReactFlow instance is not defined.')
      }
      const flow = rfInstance.toObject();
      const res = await axios.post(`${conf.api.url}/map`, {
        title: `${duplicate ? title : 'Untitled'}: (${faker.commerce.productName()})`,
        flow: duplicate ? flow : {
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('post map res:', res)
      // setResponseMessage(`Map created successfully`)
      setMaps(maps => [res.data, ...maps])
      setMapId(res.data._id)
      setTitle(res.data.title)
      setNodes(res.data.flow.nodes);
      setEdges(res.data.flow.edges);
      setViewport(res.data.flow.viewport);
      console.log('mapId:', res.data._id)
    } catch (err) {
      console.error('post map error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error posting map.'))
    } finally {
      setLoading(false)
    }
  }, [rfInstance, title, setLoading, setMaps, setMapId, setTitle, setNodes, setEdges, setViewport, setResponseError, t])

  const putMap = useCallback(async ({ loader = true } = {}) => {
    if (loader) {
      setLoading(true)
    }
    try {
      if (!mapId) {
        return await postMap()
      }
      if (!rfInstance) {
        throw new Error('ReactFlow instance is not defined.')
      }
      const flow = rfInstance.toObject();
      console.log('put mapId:', mapId)
      const res = await axios.put(`${conf.api.url}/map/${mapId}`, {
        ...getMap(mapId),
        title: title,
        flow: flow,
      }, {
        // timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('map put res:', res)
      // setResponseMessage(`Map updated successfully`)
      setMaps(maps.map(a => a._id === res.data._id ? res.data : a))
    } catch (err) {
      console.error('put map error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error putting map.'))
    } finally {
      if (loader) {
        setLoading(false)
      }
    }
  }, [mapId, setLoading, setResponseError, maps, setMaps, getMap, rfInstance, postMap, title, t])

  const deleteMap = async () => {
    setLoading(true)
    try {
      const res = await axios.delete(`${conf.api.url}/map/${mapId}`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('map delete res:', res)
      // setResponseMessage(`Map deleted successfully`)
      const newMaps = maps.filter(obj => obj._id !== mapId)
      setMaps(newMaps)
      if (newMaps.length > 0) {
        setMapId(newMaps[0]._id)
        setTitle(newMaps[0].title)
        setNodes(newMaps[0].flow.nodes);
        setEdges(newMaps[0].flow.edges);
        setViewport(newMaps[0].flow.viewport);
      } else {
        await postMap()
      }
    } catch (err) {
      console.error('delete map error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error deleting map.'))
    } finally {
      setLoading(false)
    }
  }

  const downloadMap = () => {
    setLoading(true)
    try {
      if (!rfInstance) {
        throw new Error('ReactFlow instance is not defined.')
      }
      const flow = rfInstance.toObject();
      const data = {
        title,
        flow,
      }
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}.sdm.json`;
      link.click();
      URL.revokeObjectURL(url); // Clean up
    } catch (err) {
      console.error('download map error:', err);
      return setResponseError(err?.response?.data?.message || err.toString() || t('Error downloading map.'))
    } finally {
      setLoading(false)
    }
  };

  const uploadMap = (event) => {
    setLoading(true)
    try {
      const file = event.target.files[0];
      if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            await postMap()
            const parsedMap = JSON.parse(e.target.result);
            setTitle(parsedMap?.title)
            const { x = 0, y = 0, zoom = 1 } = parsedMap.flow.viewport;
            setNodes(parsedMap.flow.nodes || []);
            setEdges(parsedMap.flow.edges || []);
            setViewport({ x, y, zoom });
            console.log(`Map ${parsedMap?.title} loaded with flow:`, parsedMap.flow);
          } catch (err) {
            console.error('Error on uploading map:', err)
            alert(t('Invalid JSON file.'))
          }
        };
        reader.readAsText(file);
      } else {
        alert(t('Please upload a valid JSON file.'))
      }
    } catch (err) {
      console.error('upload map error:', err);
      return setResponseError(err.toString() || t('Error uploading map.'))
    } finally {
      setLoading(false)
    }
  };

  const uploadMapInit = () => {
    fileInputRef.current.click(); // triggers hidden input
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      if (autosave) {
         console.log("Autosave");
         await putMap({ loader: false })
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [autosave, putMap]);

  const attachFile = async (event) => {
    return new Promise((resolve, reject) => {
      try {
        const file = event.target.files[0];
        if (!file) {
          throw new Error(`Error attaching file: ${file}`)
        }
        const reader = new FileReader();
        reader.onload = async () => {
          // console.log('Loaded file:', e.target.result)
          const getUrl = await xmppClient.uploadFile({
            buffer: reader.result,
            filename: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            shareHost: conf.xmpp.shareHost,
          })
          resolve(getUrl)
        };
        reader.onerror = (err) => {
          throw err
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        reject(err);
      }
    })
  }

  const onConnect = useCallback(async (params) => {
    const edgeId = `${params.source}->${params.target}`
    const variableEdge = {
      ...params,
      id: edgeId,
      type: 'RequestEdge',
      data: {
        condition,
        stroke,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke },
      animated: true,
    };
    // console.log('onConnect variableEdge:', variableEdge, ', params:', params)
    setEdges((eds) => addEdge(variableEdge, eds));
    await sleep(100) // NOTE: the sleep is needed to update edges before playing them

    const nodes = getNodes()
    const sourceNode = nodes.find(node => node.id === params.source)
    await playEdge({
      sourceNodeData: sourceNode.data, edgeData: variableEdge.data,
      getNodes, setNodes, getEdges, setEdges,
      xmppClient,
      edgeId, targetId: params.target,
    })
  }, [setEdges, condition, stroke, xmppClient, getNodes, setNodes, getEdges ]);

  // const onReconnect = useCallback(
  //   (oldEdge, newConnection) =>
  //     setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),
  //   [],
  // );

  const onEdgesDelete = (deletedEdges) => {
    console.log('Deleted edges:', deletedEdges);
    deletedEdges.forEach((edge) => {
      unlinkEdge({ edge, getNodes, setNodes })
    });
  };

  const addNote = useCallback(({ text = '', editing = true, toCenter = true } = {}) => {
    const id = getNodeId()
    const position = screenToFlowPosition({ x: width/2, y: (toCenter ? height/2 : height), })
    position.x -= 300
    position.y -= 200
    console.log('position:', position)
    const newNode = {
      id,
      type: 'NoteNode',
      position,
      data: {
        uname: getUname(id),
        text,
        editing,
        renaming: false,
        color,
        backgroundColor,
      },
      // Make the proper sizing. Allow dynamic change of heigth.
      width: 600,
      height: undefined,
    };
    setNodes((nds) => nds.concat(newNode));
    return newNode
  }, [setNodes, width, height, screenToFlowPosition, color, backgroundColor]);

  const groupSelected = useCallback(() => {
    let selectedCount = 0
    let x = undefined
    let y = undefined
    let x1 = 600
    let y1 = 600
    for (let node of getNodes()) {
      if (node.selected) {
        selectedCount += 1
        if (x === undefined || y === undefined) {
          x = node.position.x
          y = node.position.y
          x1 = x + 600
          y1 = y + 600
        } else {
          x = Math.min(x, node.position.x)
          y = Math.min(y, node.position.y)
        }
        x1 = Math.max(x1, node.position.x + (node.style?.width || 600))
        y1 = Math.max(y1, node.position.y + (node.style?.height || 600))
      }
    }
    const id = getNodeId()
    const newNode = {
      id,
      position: selectedCount > 0 ? { x, y } : screenToFlowPosition({ x: width*3/4, y: height/3, }),
      data: {
        uname: getUgroup(id),
        renaming: false,
        color,
        backgroundColor,
        and: false,
      },
      style: {
        width: x1 - (x || 0),
        height: y1 - (y || 0),
      },
      type: 'group',
    };
    setNodes((nodes) => {
      nodes.unshift(newNode)
      return nodes.map((node) =>
        node.selected ? { ...node, parentId: id, extent: 'parent' } : node
      )
    })
  }, [setNodes, getNodes, width, height, screenToFlowPosition, color, backgroundColor]);

  const onConnectEnd = useCallback(async (event, connection) => {
    console.log('onConnectEnd event:', event, ', connection:', connection)

    // when a connection is dropped on the pane it's not valid
    if (connection.isValid) {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === connection.toNode.id ? {
            ...node,
            data: {
              ...node.data,
              text: node.data.text + `[[${connection.fromNode.data.uname}]]`,
            }
          } : node
        )
      );
    } else {
      if (!recipient) {
        return alert(t('Please select recipient'))
      }

      const id = getNodeId();
      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: clientX, y: clientY, })
      position.x -= 300
      const newNode = {
        id,
        position,
        data: {
          uname: getUname(id),
          text: '',
          editing: false,
          renaming: false,
          color,
          backgroundColor,
        },
        type: 'NoteNode',
      };
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === connection.fromNode.id ? { ...node, data: { ...node.data, editing: false } } : node
        ).concat(newNode)
      );

      const edgeId = `${connection.fromNode.id}->${id}`
      const newEdge = {
        id: edgeId,
        source: connection.fromNode.id,
        target: id,
        type: 'RequestEdge',
        data: {
          recipient,
          condition,
          stroke,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke },
      }
      setEdges((edges) =>
        edges.concat(newEdge),
      );

      await playEdge({
        sourceNodeData: connection.fromNode.data, edgeData: newEdge.data,
        getNodes, setNodes, getEdges, setEdges,
        xmppClient,
        edgeId, targetId: id,
      })

      return { newNode, newEdge }
    }
  }, [screenToFlowPosition, xmppClient, recipient, condition, getNodes, setNodes, getEdges, setEdges, color, backgroundColor, stroke, t]);

  const inputPrompt = useCallback(async ({ text }) => {
    const connection = {
      isValid: false,
      fromNode: null,
    }
    connection.fromNode = addNote({ text, editing: false, toCenter: false })
    let node1 = null, width1 = null, height1 = null
    for (let i = 0; i < 20; i++) {
      node1 = getNode(connection.fromNode.id);
      width1 = node1?.width || node1?.measured?.width
      height1 = node1?.height || node1?.measured?.height
      if (node1 && width1 && height1) {
        break
      }
      await sleep(100)
    }
    // console.log('node1:', node1, ', width1:', width1, ', height1:', height1)

    const edgeHeight = 100
    const yOffset = 100

    console.log('connection.fromNode:', connection.fromNode)
    const screenPosition = flowToScreenPosition({
      x: connection.fromNode.position.x + width1 / 2,
      y: connection.fromNode.position.y + height1 + edgeHeight,
    })
    console.log('screenPosition:', screenPosition)
    const event = {
      clientX: screenPosition.x,
      clientY: screenPosition.y,
    }
    console.log('event:', event)
    const { newNode } = await onConnectEnd(event, connection)

    let node2 = null, width2 = null, height2 = null
    for (let i = 0; i < 20; i++) {
      node2 = getNode(newNode.id);
      width2 = node2?.width || node2?.measured?.width
      height2 = node2?.height || node2?.measured?.height
      if (node2 && width2 && height2) {
        break
      }
      await sleep(100)
    }
    // console.log('node2:', node2, ', width2:', width2, ', height2:', height2)

    const viewport = getViewport()
    viewport.y -= (height1 + edgeHeight + height2 + yOffset) * viewport.zoom
    setViewport(viewport, { duration: 1000, interpolate: "smooth" })
  }, [addNote, onConnectEnd, getNode, flowToScreenPosition, setViewport, getViewport, height])


  const playMap = useCallback(async ({ step = false } = {}) => {
    return playMapCore({
      step, xmppClient,
      setPlaying, setPausing, setStepping, setReordering,
      playingRef, pausingRef, steppingRef,
      getNodes, getEdges, setNodes, setEdges,
    })
  }, [xmppClient, setPlaying, setPausing, setReordering, getNodes, getEdges, setNodes, setEdges])

  const stepMap = useCallback(() => {
    setStepping(true)
    setPausing(pausing => !pausing)
    setReordering(false)
    console.log('stepMap')
    if (!playing) {
      playMap({ step: true })
    }
  }, [ playing, playMap, setPausing, setReordering ])

  const pauseMap = useCallback(() => {
    setPausing(pausing => !pausing)
    setReordering(false)
    console.log('pauseMap')
  }, [setPausing, setReordering])

  const stopMap = useCallback(() => {
    setPlaying(false)
    setStepping(false)
    setPausing(false)
    setReordering(false)
    console.log('stopMap')
    setEdges((edges) =>
      edges.map((edge) => { return { ...edge, data: { ...edge.data, sequence: undefined, expecting: undefined } } } )
    );
  }, [setPlaying, setPausing, setReordering, setEdges])

  async function executeMapOnBackend () {
    try {
      const response = await axios.post(`${conf.api.url}/executor/map/${mapId}`, { }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('/executor/map response:', response)
      const { _id, title } = response.data
      console.log('Result map title:', title, ', _id:', _id)
      setResponseMessage(t('map_executing', { title, _id }));
    } catch (err) {
      console.error('executeMapOnBackend error:', err)
      setResponseError(err?.response?.data?.message || t('Error executing map on backend.'))
    }
  }

  const orderEdges = useCallback(() => {
    setReordering(reordering => {
      let sequence = 1
      setEdges((edges) =>
        edges.map((edge) => {
          return { ...edge, data: { ...edge.data, sequence: !reordering ? sequence++ : undefined, cursor: undefined } }
        })
      );
      return !reordering
    })
  }, [setEdges])

  const navigateSlide = useCallback((direction) => {
    // Step 1: Filter and sort slide nodes by slideIndex
    const slideNodes = nodes
      .filter(nd => nd.data?.slide)
      .sort((a, b) => (a.data.slideIndex ?? 0) - (b.data.slideIndex ?? 0));

    // Step 2: Find current index in slideNodes
    const currentIndex = slideNodes.findIndex(n => n.data.slideIndex === currentSlide);

    // Step 3: Calculate next index with wraparound
    let gotoIndex = currentIndex + direction;
    if (gotoIndex >= slideNodes.length) gotoIndex = 0;
    if (gotoIndex < 0) gotoIndex = slideNodes.length - 1;
    const gotoNode = slideNodes[gotoIndex];

    setTimeout(() => {
      // NOTE: fitView is deferred to ensure layout is up to date
      fitView({ nodes: [gotoNode], duration: 1000 });
    }, 0);
    setCurrentSlide(gotoNode.data.slideIndex);
  }, [currentSlide, setCurrentSlide, fitView, nodes]);


  const nextSlide = useCallback((e) => {
    e.stopPropagation();
    navigateSlide(1);
  }, [navigateSlide]);

  const previousSlide = useCallback((e) => {
    e.stopPropagation();
    navigateSlide(-1);
  }, [navigateSlide]);

  // useEffect(() => {
  //   console.log('Current edges state:', edges);
  // }, [edges]);

  const onLayout = useCallback((direction) => {
    console.log(nodes);
    const layouted = getLayoutedElements(nodes, edges, { direction });
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    fitView();
  }, [nodes, edges, setNodes, setEdges, fitView]);

  return (
    <MapContext.Provider value={{
      presence, roster, recipient,
      xmppClient,
      condition, reordering, getEdges, setEdges, getNodes, setNodes,
      orderEdges, editorTheme, vimMode, viewerTheme, markdownEditor,
      setCurrentSlide, attachFile,
    }}>
      <Container fluid>
        <Menubar>
          <Menu.Item style={{
            padding: '0 0.7rem 0 0',
            backgroundImage: texturePattern,
          }}/>
          <Menu.Header style={{
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem',
          }}>
            { !showMenu && (<>
              <Button.Group>
                <Popup
                  content={ !showMenu ? t('Show the Map menu') : t('Hide the Map menu') }
                  trigger={
                    <Button
                      icon basic
                      onClick={() => setShowMenu(!showMenu)}
                    >
                      <Icon name={'bars'}
                        color={showMenu ? 'grey' : 'standard'}
                      />
                    </Button>
                  }
                />
              </Button.Group>
            </>)}
            { showMenu && (<>
              <Menu compact secondary style={{
                marginLeft: '1rem',
                display: 'flex',
                alignItems: 'center',       // vertically center
              }}>
                <Menu.Menu>
                  <Dropdown simple text={t('File')} icon=''>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={postMap}>
                        <Icon name='file' />
                        {t('New')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={putMap}>
                        <Icon name='save' />
                        {t('Save')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => postMap({ duplicate: true })}>
                        <Icon name='clone' />
                        {t('Duplicate')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => {setRenaming(renaming => !renaming)}}>
                        <Icon name='text cursor' />
                        {t('Rename')}
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item>
                        <Popup content={ autosave ? t('Disable autosave') : t('Enable autosave') } trigger={
                          <Checkbox
                            label={t('Autosave')}
                            onChange={(e, data) => setAutosave(data.checked)}
                            checked={autosave}
                          />
                        } />
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={downloadMap}>
                        <Icon name='download' />
                        {t('Download')}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={uploadMapInit}>
                        <Icon name='upload' />
                        {t('Upload')}
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={() => {
                        setConfirm({
                          open: true,
                          header: t('Confirm Map Delete'),
                          message: t('Are you sure you want to delete your map?'),
                          func: deleteMap,
                        })
                      } }>
                        <Icon name='trash alternate' />
                        {t('Delete')}
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </Menu.Menu>

                <Menu.Menu>
                  <Dropdown simple text={t('View')} icon=''>
                    <Dropdown.Menu>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show menu')}
                          onChange={(e, data) => setShowMenu(data.checked)}
                          checked={showMenu}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show opener')}
                          onChange={(e, data) => setShowOpener(data.checked)}
                          checked={showOpener}
                        />
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show file controls')}
                          onChange={(e, data) => setShowFile(data.checked)}
                          checked={showFile}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show layout controls')}
                          onChange={(e, data) => setShowLayout(data.checked)}
                          checked={showLayout}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show color controls')}
                          onChange={(e, data) => setShowColors(data.checked)}
                          checked={showColors}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show execution controls')}
                          onChange={(e, data) => setShowExecution(data.checked)}
                          checked={showExecution}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show slide controls')}
                          onChange={(e, data) => setShowSlides(data.checked)}
                          checked={showSlides}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show prompt controls')}
                          onChange={(e, data) => setShowPrompt(data.checked)}
                          checked={showPrompt}
                        />
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show slides deck sidebar')}
                          checked={deckSidebar}
                          onChange={(e, data) => setDeckSidebar(data.checked)}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show prompt input')}
                          checked={promptInput}
                          onChange={(e, data) => setPromptInput(data.checked)}
                        />
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show mini map')}
                          onChange={(e, data) => setShowMinimap(data.checked)}
                          checked={showMinimap}
                        />
                      </Dropdown.Item>
                      <Dropdown.Item>
                        <Checkbox
                          label={t('Show control panel')}
                          onChange={(e, data) => setShowPanel(data.checked)}
                          checked={showPanel}
                        />
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </Menu.Menu>

                <Menu.Menu>
                  <Dropdown simple text={t('Settings')} icon=''>
                    <Dropdown.Menu>
                      <Dropdown text={t('Code viewer theme')} pointing='left' className='link item'>
                        <Dropdown.Menu>
                          { Object.keys(editorThemes).map((thm) => {
                            if (thm === '-' || thm === '--') {
                              return (
                                <Dropdown.Divider key={thm} />
                              )
                            }
                            return (
                              <Dropdown.Item key={thm} onClick={() => { setViewerTheme(thm) } }>
                                <Icon name={ viewerTheme === thm ? 'dot circle' : 'circle outline'} />
                                {thm}
                              </Dropdown.Item>
                            )
                          } ) }
                        </Dropdown.Menu>
                      </Dropdown>
                      <Dropdown text={t('Code editor theme')} pointing='left' className='link item'>
                        <Dropdown.Menu>
                          { Object.keys(editorThemes).map((thm) => {
                            if (thm === '-' || thm === '--') {
                              return (
                                <Dropdown.Divider key={thm} />
                              )
                            }
                            return (
                              <Dropdown.Item key={thm} onClick={() => { setEditorTheme(thm) } }>
                                <Icon name={ editorTheme === thm ? 'dot circle' : 'circle outline'} />
                                {thm}
                              </Dropdown.Item>
                            )
                          } ) }
                        </Dropdown.Menu>
                      </Dropdown>
                      <Dropdown text={t('Code editor mode')} pointing='left' className='link item'>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => { setVimMode(false) } }>
                            <Icon name={ !vimMode ? 'dot circle' : 'circle outline'} />
                            {t('Normal')}
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => { setVimMode(true) } }>
                            <Icon name={ vimMode ? 'dot circle' : 'circle outline'} />
                            {t('Vim')}
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                      <Dropdown text={t('Markdown editor options')} pointing='left' className='link item'>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => { setMarkdownEditor('text-area') } }>
                            <Icon name={ markdownEditor === 'text-area' ? 'dot circle' : 'circle outline'} />
                            {t('Text-area')}
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => { setMarkdownEditor('markdown') } }>
                            <Icon name={ markdownEditor === 'markdown' ? 'dot circle' : 'circle outline'} />
                            {t('Markdown editor (light)')}
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => { setMarkdownEditor('markdown-dark') } }>
                            <Icon name={ markdownEditor === 'markdown-dark' ? 'dot circle' : 'circle outline'} />
                            {t('Markdown editor (dark)')}
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => { setMarkdownEditor('code') } }>
                            <Icon name={ markdownEditor === 'code' ? 'dot circle' : 'circle outline'} />
                            {t('Code editor')}
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => { setMarkdownEditor('code-preview') } }>
                            <Icon name={ markdownEditor === 'code-preview' ? 'dot circle' : 'circle outline'} />
                            {t('Code editor with preview')}
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </Dropdown.Menu>
                  </Dropdown>
                </Menu.Menu>
              </Menu>
            </>) }
          </Menu.Header>
        </Menubar>
      </Container>

      <Modal
        closeIcon
        open={confirm.open}
        onClose={() => setConfirm(hiddenConfirm)}
      >
        <Modal.Header>{confirm.header}</Modal.Header>
        <Modal.Content>{confirm.message}</Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setConfirm(hiddenConfirm)}>
            {t('Cancel')}
          </Button>
          <Button positive onClick={() => {
            setConfirm(hiddenConfirm)
            confirm.func()
          }}>
            {t('Delete')}
          </Button>
        </Modal.Actions>
      </Modal>

      { showFile && (<>
        {' '} {' '}
        <Button.Group>
          <Popup content={t('Create a new map')} trigger={
            <Button icon onClick={postMap}>
              <Icon name='file' />
            </Button>
          } />
          <Popup content={t('Save the map')} trigger={
            <Button icon onClick={putMap}>
              <Icon name='save' />
            </Button>
          } />
          <Popup content={t('Duplicate the map')} trigger={
            <Button icon onClick={() => postMap({ duplicate: true })}>
              <Icon name='clone' />
            </Button>
          } />
          <Popup content={t('Delete the map')} trigger={
            <Button icon onClick={() => {
              setConfirm({
                open: true,
                header: t('Confirm Map Delete'),
                message: t('Are you sure you want to delete your map?'),
                func: deleteMap,
              })
            } }>
              <Icon name='trash alternate' />
            </Button>
          } />
          <Popup content={t('Download the map')} trigger={
            <Button icon onClick={downloadMap}>
              <Icon name='download' />
            </Button>
          } />
          <Popup content={t('Upload the map')} trigger={
            <Button icon onClick={uploadMapInit}>
              <Icon name="upload" />
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                onChange={uploadMap}
                style={{ display: 'none' }} // hide input
              />
            </Button>
          } />
          <Popup content={t('Rename the map')} trigger={
            <Button icon onClick={() => {setRenaming(renaming => !renaming)}}>
              <Icon name='text cursor' />
            </Button>
          } />
        </Button.Group>
        {' '}
      </>)}

      { renaming && (<>
        <span style={{ marginLeft: '1em' }} />
        {' '}
        <Input
          iconPosition='left'
          placeholder={t('Title...')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setRenaming(renaming => !renaming)
            }
            if (e.key === 'Escape') {
              setRenaming(renaming => !renaming)
              setTitle(getMap(mapId).title)
            }
          }}
        ><Icon name='map' /><input /></Input>
        {' '}
        <Button.Group>
          <Button icon positive onClick={() => {setRenaming(renaming => !renaming)}}>
            <Icon name='check' />
          </Button>
          <Button.Or />
          <Button icon
            onClick={() => {
              setRenaming(renaming => !renaming)
              setTitle(getMap(mapId).title)
            }}
          >
            <Icon name='cancel' />
          </Button>
        </Button.Group>
      </>)}
      { !renaming && showOpener && (<>
        {' '}
        <Icon name='folder open outline' />
        <Popup content={t('Select a map to open')} trigger={
          <Dropdown text={title} icon='caret down' open={opener} onClick={() => setOpener(!opener)}>
            <Dropdown.Menu>
              <Input
                icon='search' iconPosition='left' className='search'
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setOpenerSearch(e.target.value)}
              />
              <Dropdown.Header icon='map' content='Maps:' />
              <Dropdown.Menu scrolling>
                {maps
                  .filter(({ title }) => title?.includes(openerSearch))
                  .map(({ _id, title }) => (
                    <Dropdown.Item
                      key={_id} value={_id} text={title}
                      active={_id === mapId}
                      onClick={(e, { value }) => {
                        setMapId(value)
                        const map = getMap(value)
                        setTitle(map?.title)
                        const { x = 0, y = 0, zoom = 1 } = map.flow.viewport;
                        setNodes(map.flow.nodes || []);
                        setEdges(map.flow.edges || []);
                        setViewport({ x, y, zoom });
                        console.log(`Map ${map?.title} loaded with flow:`, map.flow);
                      } }
                    />
                  ))
                }
              </Dropdown.Menu>
            </Dropdown.Menu>
          </Dropdown>
        } />
        <Button.Group>
          <Popup content={t('Show map info')} trigger={
            <Button icon basic onClick={() => { setResponseMessage(t('The map id is {{mapId}}', { mapId })) }}>
              <Icon name='info circle' color='blue' />
            </Button>
          } />
        </Button.Group>
      </>)}

      { showLayout && (<>
        {' '}
        <Button.Group>
          <Popup content={t('Top-to-bottom layout')} trigger={
            <Button icon basic onClick={() => onLayout('TB')}>
              <Icon name='grid layout' />
            </Button>
          } />
          <Popup content={t('Left-to-right layout')} trigger={
            <Button icon basic onClick={() => onLayout('LR')}>
              <Icon name='list layout' />
            </Button>
          } />
        </Button.Group>
      </>)}

      { showColors && (<>
        {' '} {' '}
        <Popup content={t('Apply text color to selected notes')} trigger={
          <Icon name='font' color='grey' onClick={() => {
            setNodes((nodes) =>
              nodes.map((node) =>
                node.selected ? { ...node, data: { ...node.data, color } } : node
              )
            )
          }} />
        } />
        <Popup content={t('Select text color')} trigger={
          <input
            className="nodrag"
            type="color"
            onChange={(e) => {
              console.log('color:', e.target.value)
              setColor(e.target.value)
              setNodes((nodes) =>
                nodes.map((node) =>
                  node.selected ? { ...node, data: { ...node.data, color: e.target.value } } : node
                )
              )
            } }
            value={color}
          />
        } />
        {' '}
        <Popup content={t('Apply background color to selected notes')} trigger={
          <Icon name='paint brush' color='grey' onClick={() => {
            setNodes((nodes) =>
              nodes.map((node) =>
                node.selected ? { ...node, data: { ...node.data, backgroundColor } } : node
              )
            )
          }} />
        } />
        <Popup content={t('Select background color')} trigger={
          <input
            className="nodrag"
            type="color"
            onChange={(e) => {
              setBackgroundColor(e.target.value)
              setNodes((nodes) =>
                nodes.map((node) =>
                  node.selected ? { ...node, data: { ...node.data, backgroundColor: e.target.value } } : node
                )
              )
            } }
            value={backgroundColor}
          />
        } />
        {' '}
        <Popup content={t('Apply edge color to selected notes')} trigger={
          <Icon name='linkify' color='grey' onClick={() => {
            setEdges((edges) =>
              edges.map((edge) =>
                edge.selected ? { ...edge, data: { ...edge.data, stroke }, markerEnd: { ...edge.markerEnd, color: stroke } } : edge
              )
            );
          }} />
        } />
        <Popup content={t('Select edge color')} trigger={
          <input
            className="nodrag"
            type="color"
            onChange={(e) => {
              setStroke(e.target.value)
              setEdges((edges) =>
                edges.map((edge) =>
                  edge.selected ? { ...edge, data: { ...edge.data, stroke: e.target.value }, markerEnd: { ...edge.markerEnd, color: stroke } } : edge
                )
              );
            } }
            value={stroke}
          />
        } />
        {' '}
        <Popup content={t('Select text, background and edge colors by default')} trigger={
          <Icon name='history' color='grey' onClick={() => {
            setColor(defaultColor)
            setBackgroundColor(defaultBackgroundColor)
            setStroke(defaultStroke)
          }} />
        } />
      </>)}

      { showExecution && (<>
        {' '} {' '}
        <Button.Group>
          <Popup content={t('Reorder edges')} trigger={
            <Button icon basic onClick={orderEdges}>
              <Icon name='sort' color={ reordering ? 'blue' : 'grey' } />
            </Button>
          } />
          {playing ? (
            <>
              {pausing ? (
                <Popup content={t('Resume running the map')} trigger={
                  <Button icon basic onClick={pauseMap}>
                    <Icon name='play' color='yellow' />
                  </Button>
                } />
              ) : (
                <Popup content={t('Pause running the map')} trigger={
                  <Button icon basic onClick={pauseMap}>
                    <Icon name='pause' color='yellow' />
                  </Button>
                } />
              )}
            </>
          ) : (<>
            <Popup content={t('Run the map')} trigger={
              <Button icon basic onClick={playMap}>
                <Icon name='play' color='green' />
              </Button>
            } />
          </>)}
          <Popup content={t('Step forward')} trigger={
            <Button icon basic onClick={stepMap}>
              <Icon name='step forward' color={ stepping ? 'olive' : 'yellow' } />
            </Button>
          } />
          <Popup content={t('Stop running the map')} trigger={
            <Button icon basic onClick={stopMap} disabled={!playing}>
              <Icon name='stop' color='red' disabled={!playing} />
            </Button>
          } />
          <Popup content={t('Execute the map on backend')} trigger={
            <Button icon basic onClick={executeMapOnBackend}>
              <Icon name='rocket' color='violet' />
            </Button>
          } />
        </Button.Group>
      </>)}

      { showSlides && (<>
        {' '} {' '}
        <Button.Group>
          <Popup
            content={ !deckSidebar ? t('Show slide deck sidebar') : t('Hide slide deck sidebar') }
            trigger={
              <Button
                icon basic
                onClick={() => setDeckSidebar(!deckSidebar)}
              >
                <Icon name={deckSidebar ? 'images' : 'images outline'}
                  color={deckSidebar ? 'blue' : 'standard'}
                />
              </Button>
            }
          />
          <Popup content={t('Previous slide')} trigger={
            <Button icon basic onClick={previousSlide}>
              <Icon name='caret square left outline' color='blue' />
            </Button>
          } />
          <Popup content={t('Next slide')} trigger={
            <Button icon basic onClick={nextSlide}>
              <Icon name='caret square right outline' color='blue' />
            </Button>
          } />
        </Button.Group>
      </>)}

      { showPrompt && (<>
        {' '} {' '}
        <Button.Group>
          <Popup
            content={ !promptInput ? t('Show prompt input') : t('Hide prompt input') }
            trigger={
              <Button
                icon basic
                onClick={() => setPromptInput(!promptInput)}
              >
                <Icon name={promptInput ? 'edit' : 'edit outline'}
                  color={promptInput ? 'blue' : 'standard'}
                />
              </Button>
            }
          />
        </Button.Group>
      </>)}


      <Loader active={loading} inline='centered' />
      { responseError &&
        <Message
          negative
          icon='exclamation circle'
          header='Error'
          content={responseError}
          onDismiss={() => setResponseError('')}
          style={{
            textAlign: 'left',
          }}
        />
      }
      { responseMessage &&
        <Message
          positive
          style={{ textAlign: 'left'}}
          icon='info circle'
          header={t('Info')}
          content={responseMessage}
          onDismiss={() => setResponseMessage('')}
        />
      }

      <Sidebar.Pushable as={Container} fluid>
        <Sidebar
          animation='push'
          width='very wide'
          direction='bottom'
          visible={promptInput}
        >

          <div style={{
            display: "flex",
            justifyContent: "center",
            margin: '1rem'
          }}>
            <TextareaAutosize
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) {
                  e.preventDefault();
                  inputPrompt({ text: prompt })
                  setPrompt('')
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  // cancelText()
                }
              }}
              className="nodrag"
              minRows={6}
              maxRows={12}
              style={{
                fontSize: '1.6rem',
                width: '100%',
                maxWidth: '900px',
                height: '100%',
              }}
            />
            <Button
              icon
              style={{ marginLeft: '0.5rem' }}
              onClick={() => { inputPrompt({ text: prompt }); setPrompt('') }}
            >
              <Icon name='arrow up' />
            </Button>
          </div>
        </Sidebar>
        <Sidebar.Pusher dimmed={false}>

          <Sidebar.Pushable>
            <Sidebar
              as={Menu}
              animation='overlay'
              icon='labeled'
              inverted
              // onHide={() => setDeckSidebar(false)}
              vertical
              width='thin'
              visible={deckSidebar}
            >
              { nodes
                .filter(nd => nd.data?.slide)
                .sort((a, b) => (a.data.slideIndex ?? 0) - (b.data.slideIndex ?? 0))
                .map(nd => (
                  <Menu.Item
                    key={nd.id}
                    active={nd.data.slideIndex === currentSlide}
                    onClick={() => {
                      setTimeout(() => {
                        // NOTE: fitView is deferred to ensure layout is up to date
                        fitView({ nodes: [nd], duration: 1000 });
                      }, 0);
                      setCurrentSlide(nd.data.slideIndex);
                    }}
                  >
                    <Icon name='image outline' />
                    {nd.data.slideIndex+1}. {nd.data.uname}
                  </Menu.Item>
                ))
              }
            </Sidebar>

            <Sidebar.Pusher dimmed={false}>
              <div
                className="wrapper" ref={reactFlowWrapper}
                style={{
                  width: width,
                  height: height - conf.iframe.topOffset - conf.iframe.bottomOffset,
                }}
              >
                <ReactFlow
                  style={{ backgroundColor: "#F7F9FB" }}
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onEdgesDelete={onEdgesDelete}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onInit={setRfInstance}
                  onConnect={onConnect}
                  onConnectEnd={onConnectEnd}
                  // onReconnect={onReconnect}
                  fitView
                  fitViewOptions={{ padding: 2 }}
                  // nodeOrigin={nodeOrigin}

                  panOnScroll={true}
                  selectionOnDrag={true}
                  selectionMode={SelectionMode.Partial}
                  panOnDrag={[1, 2]}

                  minZoom={0.01}
                  maxZoom={10}
                >
                  <Controls position={promptInput ? 'center-left' : 'bottom-left'}/>
                  { showMinimap && (
                    <MiniMap pannable zoomable position='top-left' />
                  )}
                  <Background variant="dots" gap={12} size={1} />
                  { showPanel && (
                    <Panel position="top-right">
                      <Popup content={t('Select recipient')} trigger={
                        <Dropdown
                          compact
                          fluid
                          selection
                          clearable
                          onSearchChange={(e, { value }) => setRecipientSearch(value)}
                          trigger={
                            <>
                            { !recipientSearch && (
                              <span>
                                <Icon name='user' color={ presence[recipient] ? 'green' : 'grey' }/>
                                {(roster.find(r => r.jid === recipient))?.name || recipient}
                              </span>
                            )}
                            </>
                          }
                          multiple={false}
                          search={true}
                          options={
                            roster.map(r => {
                              return {
                                key: r.jid,
                                text: r.name,
                                value: r.jid,
                                content: (
                                  <>
                                    <Icon name='user' color={presence[r.jid] ? 'green' : 'grey'} />
                                    {r.name}
                                  </>
                                ),
                              }
                            })
                          }
                          value={recipient}
                          placeholder={t('Recipient')}
                          onChange={(e, { value }) => { setRecipient(value); setRecipientSearch('') }}
                          loading={roster.length === 0}
                        />
                      } />
                      <Input
                        iconPosition='left'
                        placeholder={t('/RegExp/ Condition...')}
                        value={condition}
                        onChange={e => setCondition(e.target.value)}
                        fluid
                      ><Icon name='usb' /><input /></Input>
                      <Button.Group vertical labeled icon fluid compact>
                        <Button icon='sticky note outline' content={t('Add Note')} onClick={addNote} />
                        <Button icon='object group' content={t('Loop Selected')} onClick={groupSelected} />
                      </Button.Group>
                      <br/>
                      {/*
                      <Input
                        iconPosition='left' placeholder='room...' size='mini'
                        value={room}
                        onChange={e => setRoom(e.target.value)}
                      ><Icon name='group' /><input /></Input>
                      <Button basic size='mini'
                        onClick={async () => {
                          await xmppClient.sendRoomMessage({ room, recipient, prompt, mucHost: conf.xmpp.mucHost });
                        }}
                      >Groupchat</Button>
                      <Input
                        iconPosition='left' placeholder='prompt...' size='mini'
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                      ><Icon name='edit outline' /><input /></Input>
                      */}
                      <br />
                    </Panel>
                  )}
                </ReactFlow>
              </div>
            </Sidebar.Pusher>
          </Sidebar.Pushable>

        </Sidebar.Pusher>
      </Sidebar.Pushable>

    </MapContext.Provider>
  )
}

export default function MapProvider () {
  return (
    <ReactFlowProvider>
      <Map />
    </ReactFlowProvider>
  )
};
