import React, { useEffect, memo } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkSlug from 'remark-slug';
import rehypeMathjax from 'rehype-mathjax'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { coy as hlStyle } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { okaidia as hlStyleDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
// import { coyWithoutShadows as hlStyle } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mermaid from 'mermaid'

export const TextAuto = (props) => {
  return <TextareaAutosize rows={1} {...props} />
}

const MarkdownHighlighter = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");

    return !inline && match ? (
      <SyntaxHighlighter
        style={hlStyle}
        PreTag="div"
        language={match[1]}
        children={String(children).replace(/\n$/, "")}
        {...props}
      />
    ) : (
      <code className={className ? className : ""} {...props}>
        {children}
      </code>
    )
  }
}

const MarkdownHighlighterDark = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");

    return !inline && match ? (
      <SyntaxHighlighter
        style={hlStyleDark}
        PreTag="div"
        language={match[1]}
        children={String(children).replace(/\n$/, "")}
        {...props}
      />
    ) : (
      <code className={className ? className : ""} {...props}>
        {children}
      </code>
    )
  }
}

export const QCMarkdown = ({ children, dark }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath, remarkSlug]}
    rehypePlugins={[rehypeMathjax]}
    components={dark ? MarkdownHighlighterDark : MarkdownHighlighter}
  >
    {children}
  </ReactMarkdown>
)

const Mermaid = memo(({ chart }) => {
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
    mermaid.contentLoaded();
  }, [chart]);

  return (
    <pre className="mermaid">
      {chart}
    </pre>
  );
});

export const MarkdownMermaid = memo(({ children, dark }) => {
  const baseComponents = dark ? MarkdownHighlighterDark : MarkdownHighlighter;

  const mergedComponents = {
    ...baseComponents,
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || '');
      if (match && match[1] === 'mermaid') {
        return <Mermaid chart={children} />;
      }
      return (
        <pre>
          <code className={className}>{children}</code>
        </pre>
      );
    },
  };

  return (
    <ReactMarkdown
      urlTransform={(value) => value}  // FIXME: this is not safe but allows to render inline base64 images
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeMathjax, rehypeRaw]}
      components={mergedComponents}
    >
      {children}
    </ReactMarkdown>
  );
});
