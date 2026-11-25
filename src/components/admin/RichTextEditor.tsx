import React, { useEffect, useId, useRef, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

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
  active,
  expanded,
  controls,
  disabled = false,
  onClick,
  children,
  buttonRef,
}: {
  label: string;
  active?: boolean;
  expanded?: boolean;
  controls?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <Button
      ref={buttonRef}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      aria-controls={controls}
      variant={active ? 'primary' : 'ghost'}
      size="sm"
      className="h-11 w-11 shrink-0 p-0"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
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
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const editorId = useId();

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
        role: 'textbox',
        'aria-multiline': 'true',
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
    if (disabled) setPopover(null);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div role="status" aria-busy="true" className="h-64 overflow-hidden rounded-2xl border border-line bg-white p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-5/6" />
        <Skeleton className="mt-3 h-4 w-2/3" />
        <span className="sr-only">Carregando editor de artigo.</span>
      </div>
    );
  }

  const openPopover = (kind: 'link' | 'image') => {
    if (disabled) return;
    setUrlError('');
    setUrlValue(kind === 'link' ? String(editor.getAttributes('link')?.href || '') : '');
    setPopover(kind);
  };

  const dismissPopover = () => {
    const trigger = popover === 'link' ? linkButtonRef.current : imageButtonRef.current;
    setPopover(null);
    setUrlError('');
    window.requestAnimationFrame(() => trigger?.focus());
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

  const popoverId = `${editorId}-popover`;
  const urlInputId = `${editorId}-url`;
  const urlErrorId = `${editorId}-url-error`;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div
        role="toolbar"
        aria-label="Formatação do artigo"
        className="flex items-center gap-0.5 overflow-x-auto border-b border-line bg-paper/70 px-2 py-1.5"
      >
        <ToolbarButton label="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()}>
          <Undo2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()}>
          <Redo2 size={18} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Título 1" active={editor.isActive('heading', { level: 1 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Título 2" active={editor.isActive('heading', { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Título 3" active={editor.isActive('heading', { level: 3 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={18} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Negrito" active={editor.isActive('bold')} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton label="Itálico" active={editor.isActive('italic')} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton label="Sublinhado" active={editor.isActive('underline')} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline size={18} />
        </ToolbarButton>
        <ToolbarButton label="Riscado" active={editor.isActive('strike')} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={18} />
        </ToolbarButton>
        <ToolbarButton label="Código" active={editor.isActive('code')} disabled={disabled} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code2 size={18} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Lista com marcadores" active={editor.isActive('bulletList')} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton label="Lista numerada" active={editor.isActive('orderedList')} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton label="Citação" active={editor.isActive('blockquote')} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={18} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft size={18} />
        </ToolbarButton>
        <ToolbarButton label="Centralizar" active={editor.isActive({ textAlign: 'center' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter size={18} />
        </ToolbarButton>
        <ToolbarButton label="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight size={18} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton buttonRef={linkButtonRef} label="Inserir link" expanded={popover === 'link'} controls={popover === 'link' ? popoverId : undefined} disabled={disabled} onClick={() => openPopover('link')}>
          <Link2 size={18} />
        </ToolbarButton>
        <ToolbarButton buttonRef={imageButtonRef} label="Inserir imagem" expanded={popover === 'image'} controls={popover === 'image' ? popoverId : undefined} disabled={disabled} onClick={() => openPopover('image')}>
          <ImagePlus size={18} />
        </ToolbarButton>
        <ToolbarButton label="Limpar formatação" disabled={disabled} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting size={18} />
        </ToolbarButton>
      </div>

      {popover && (
        <div
          id={popoverId}
          role="group"
          aria-labelledby={`${urlInputId}-label`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              dismissPopover();
            }
          }}
          className="flex flex-col gap-2 border-b border-line bg-accent/5 px-3 py-3 sm:flex-row sm:items-center"
        >
          <label id={`${urlInputId}-label`} htmlFor={urlInputId} className="text-sm font-bold text-accent">
            {popover === 'link' ? 'Endereço do link' : 'URL da imagem'}
          </label>
          <input
            id={urlInputId}
            type="url"
            inputMode="url"
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
            }}
            aria-invalid={Boolean(urlError)}
            aria-describedby={urlError ? urlErrorId : undefined}
            autoFocus
            placeholder="https://..."
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={applyUrl}>
              <Check size={14} aria-hidden="true" /> Aplicar
            </Button>
            <Button size="sm" variant="secondary" onClick={dismissPopover}>Cancelar</Button>
          </div>
          {urlError && <p id={urlErrorId} role="alert" className="text-sm font-semibold text-danger">{urlError}</p>}
        </div>
      )}

      <div className="max-h-[46vh] min-h-[280px] overflow-y-auto px-4 py-4">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between border-t border-line bg-paper/50 px-3 py-2 text-xs font-semibold text-ink/50">
        <span>{stats.words} palavra{stats.words === 1 ? '' : 's'}</span>
        <span>{stats.characters} caracteres</span>
      </div>
    </div>
  );
}
