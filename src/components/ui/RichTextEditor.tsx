'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useCallback, useRef } from 'react';
import './rich-text-editor.css';

type RichTextEditorProps = {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
};

/** Reusable WYSIWYG Rich Text Editor powered by TipTap */
export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Underline,
            LinkExtension.configure({ openOnClick: false }),
            Image.configure({ inline: false, allowBase64: false }),
            Placeholder.configure({ placeholder: placeholder || 'Mulai menulis konten di sini...' }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight,
            TextStyle,
            Color,
        ],
        content,
        onUpdate: ({ editor: ed }) => {
            onChange(ed.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'focus:outline-none',
            },
        },
    });

    const handleImageUpload = useCallback(async (file: File) => {
        if (!editor) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await res.json();

            if (result.success) {
                editor.chain().focus().setImage({ src: result.url }).run();
            } else {
                alert(result.error || 'Gagal mengunggah gambar.');
            }
        } catch {
            alert('Terjadi kesalahan saat mengunggah gambar.');
        }
    }, [editor]);

    const onImageButtonClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
            e.target.value = '';
        }
    }, [handleImageUpload]);

    const setLink = useCallback(() => {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Masukkan URL link:', previousUrl);

        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="rte-editor border border-black/10 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Toolbar */}
            <div className="rte-toolbar">
                {/* Heading Select */}
                <div className="rte-toolbar-group">
                    <select
                        className="rte-toolbar-select"
                        value={
                            editor.isActive('heading', { level: 1 }) ? 'h1' :
                                editor.isActive('heading', { level: 2 }) ? 'h2' :
                                    editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'p') {
                                editor.chain().focus().setParagraph().run();
                            } else {
                                const level = Number(val.replace('h', '')) as 1 | 2 | 3;
                                editor.chain().focus().toggleHeading({ level }).run();
                            }
                        }}
                    >
                        <option value="p">Paragraf</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                    </select>
                </div>

                <div className="rte-toolbar-divider" />

                {/* Text Formatting */}
                <div className="rte-toolbar-group">
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Bold"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Italic"
                    >
                        <em>I</em>
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        title="Underline"
                    >
                        <u>U</u>
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        title="Strikethrough"
                    >
                        <s>S</s>
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        title="Highlight"
                    >
                        <span style={{ background: '#fef08a', padding: '0 4px', borderRadius: 2 }}>H</span>
                    </button>
                </div>

                <div className="rte-toolbar-divider" />

                {/* Alignment */}
                <div className="rte-toolbar-group">
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        title="Rata Kiri"
                    >
                        ≡
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        title="Rata Tengah"
                    >
                        ≡
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        title="Rata Kanan"
                    >
                        ≡
                    </button>
                </div>

                <div className="rte-toolbar-divider" />

                {/* Lists & Structure */}
                <div className="rte-toolbar-group">
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Bullet List"
                    >
                        •
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Numbered List"
                    >
                        1.
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="Blockquote"
                    >
                        &ldquo;
                    </button>
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('codeBlock') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        title="Code Block"
                    >
                        {'</>'}
                    </button>
                    <button
                        type="button"
                        className="rte-toolbar-btn"
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Garis Horizontal"
                    >
                        ―
                    </button>
                </div>

                <div className="rte-toolbar-divider" />

                {/* Media & Link */}
                <div className="rte-toolbar-group">
                    <button
                        type="button"
                        className={`rte-toolbar-btn ${editor.isActive('link') ? 'is-active' : ''}`}
                        onClick={setLink}
                        title="Sisipkan Link"
                    >
                        🔗
                    </button>
                    <button
                        type="button"
                        className="rte-toolbar-btn"
                        onClick={onImageButtonClick}
                        title="Unggah Gambar"
                    >
                        🖼
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileSelected}
                    />
                </div>

                <div className="rte-toolbar-divider" />

                {/* Undo/Redo */}
                <div className="rte-toolbar-group">
                    <button
                        type="button"
                        className="rte-toolbar-btn"
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Undo"
                    >
                        ↩
                    </button>
                    <button
                        type="button"
                        className="rte-toolbar-btn"
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Redo"
                    >
                        ↪
                    </button>
                </div>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} />
        </div>
    );
}
