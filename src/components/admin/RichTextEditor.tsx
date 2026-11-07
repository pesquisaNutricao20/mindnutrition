import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from 'lucide-react';

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
        active ? 'bg-accent text-paper shadow-sm' : 'text-ink/60 hover:bg-white hover:text-ink'
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />;
}

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const [popover, setPopover] = useState<null | 'link' | 'image'>(null);
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');
  const [stats, setStats] = useState({ words: 0, characters: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Comece a escrever o artigo com calma. Use os títulos para organizar as ideias…',
      }),
    ],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none',
        'aria-label': 'Conteúdo do artigo',
      },
    },
    onCreate({ editor: instance }) {
      const text = instance.getText().trim();
      setStats({ words: text ? text.split(/\s+/).length : 0, characters: text.length });
    },
    onUpdate({ editor: instance }) {
      const text = instance.getText().trim();
      setStats({ words: text ? text.split(/\s+/).length : 0, characters: text.length });
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className="h-64 animate-pulse rounded-2xl border border-line bg-white" aria-hidden="true" />
    );
  }

  const openPopover = (kind: 'link' | 'image') => {
    setUrlError('');
    setUrlValue(kind === 'link' ? String(editor.getAttributes('link')?.href || '') : '');
    setPopover(kind);
  };

  const applyUrl = () => {
    const url = urlValue.trim();
    if (!url) {
      if (popover === 'link') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setPopover(null);
        return;
      }
      setUrlError('Informe o endereço da imagem.');
      return;
    }
    if (!isHttpUrl(url)) {
      setUrlError('Use um link http(s) válido.');
      return;
    }
    if (popover === 'link') {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().setImage({ src: url, alt: '' }).run();
    }
    setPopover(null);
    setUrlValue('');
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-paper/70 px-2 py-1.5">
        <ToolbarButton label="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 size={15} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={15} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton label="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton label="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline size={15} />
        </ToolbarButton>
        <ToolbarButton label="Riscado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton label="Código" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code2 size={15} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton label="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton label="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton label="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight size={15} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Inserir link" active={editor.isActive('link')} onClick={() => openPopover('link')}>
          <Link2 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Inserir imagem" active={editor.isActive('image')} onClick={() => openPopover('image')}>
          <ImagePlus size={15} />
        </ToolbarButton>
        <ToolbarButton label="Limpar formatação" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting size={15} />
        </ToolbarButton>
      </div>

      {popover && (
        <div className="flex flex-col gap-2 border-b border-line bg-accent/5 px-3 py-2.5 sm:flex-row sm:items-center">
          <span className="text-[11px] font-bold text-accent">
            {popover === 'link' ? 'Endereço do link' : 'URL da imagem'}
          </span>
          <input
            value={urlValue}
            onChange={(event) => {
              setUrlValue(event.target.value);
              setUrlError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyUrl();
              }
              if (event.key === 'Escape') setPopover(null);
            }}
            autoFocus
            placeholder="https://..."
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={applyUrl}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-paper transition hover:bg-accent/90"
            >
              <Check size={12} /> Aplicar
            </button>
            <button
              type="button"
              onClick={() => setPopover(null)}
              aria-label="Cancelar"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink/50 transition hover:bg-white"
            >
              <X size={12} />
            </button>
          </div>
          {urlError && <span className="text-[11px] font-semibold text-red-600">{urlError}</span>}
        </div>
      )}

      <div className="max-h-[46vh] min-h-[280px] overflow-y-auto px-4 py-4">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between border-t border-line bg-paper/50 px-3 py-1.5 text-[10px] font-semibold text-ink/40">
        <span>{stats.words} palavra{stats.words === 1 ? '' : 's'}</span>
        <span>{stats.characters} caracteres</span>
      </div>
    </div>
  );
}
