export const EDITOR_VIDEO_SELECTION_ATTRIBUTE = 'data-rich-editor-selected-video'

export type EditorVideo = {
  media: HTMLVideoElement | HTMLIFrameElement
  target: HTMLElement
  title: string
}

export function videoRemovalTarget(editor: HTMLElement, media: HTMLVideoElement | HTMLIFrameElement) {
  const wrapper = media.closest<HTMLElement>('figure, .video-embed')
  // A raw HTML wrapper can contain several videos or surrounding article text.
  // Only a dedicated single-video wrapper belongs to this removal action.
  if (wrapper && editor.contains(wrapper) && wrapper.querySelectorAll('iframe, video').length === 1) {
    const remainder = wrapper.cloneNode(true) as HTMLElement
    remainder.querySelectorAll('iframe, video').forEach(node => node.remove())
    if (!remainder.textContent?.trim() && !remainder.querySelector('img, audio, input, button, hr, table, script, style, textarea, select, form, object, embed, svg')) return wrapper
  }
  return media
}

export function editorVideos(editor: HTMLElement): EditorVideo[] {
  return [...editor.querySelectorAll<HTMLVideoElement | HTMLIFrameElement>('iframe, video')].map(media => ({
    media,
    target: videoRemovalTarget(editor, media),
    title: media.getAttribute('title')?.trim() || (media.tagName === 'VIDEO' ? 'Video tải lên' : 'Video nhúng'),
  }))
}

export function richEditorHtml(editor: HTMLElement) {
  // Selection is editor-only. The original media markup is saved without UI state.
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[' + EDITOR_VIDEO_SELECTION_ATTRIBUTE + ']').forEach(node => node.removeAttribute(EDITOR_VIDEO_SELECTION_ATTRIBUTE))
  return clone.innerHTML
}

export function removeEditorVideo(editor: HTMLElement, media: HTMLVideoElement | HTMLIFrameElement) {
  if (!editor.contains(media)) return false
  const target = videoRemovalTarget(editor, media)
  let parent = target.parentElement
  target.remove()
  // Empty sizing wrappers left around legacy iframes otherwise remain visible.
  while (parent && parent !== editor && /^(DIV|P|FIGURE)$/.test(parent.tagName) && !parent.textContent?.trim() && !parent.querySelector('iframe, video, img, audio, input, button, hr, table, script, style, textarea, select, form, object, embed, svg')) {
    const next = parent.parentElement
    parent.remove()
    parent = next
  }
  return true
}
