'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Type,
  Table,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  MinusCircle,
  GripVertical,
} from 'lucide-react'
import type { NoteBlock, TextBlock, TableBlock } from '@/lib/note-content'
import { parseNoteContent, serializeNoteContent } from '@/lib/note-content'

interface NoteBlockEditorProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
}

export default function NoteBlockEditor({ content, onChange, readOnly = false }: NoteBlockEditorProps) {
  const [blocks, setBlocks] = useState<NoteBlock[]>(() => parseNoteContent(content))
  const [showAddMenu, setShowAddMenu] = useState<number | null>(null)
  const [showTableCreator, setShowTableCreator] = useState<number | null>(null)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Sync from parent when content prop changes (e.g. loading a different note)
  const lastContentRef = useRef(content)
  useEffect(() => {
    if (content !== lastContentRef.current) {
      lastContentRef.current = content
      const parsed = parseNoteContent(content)
      queueMicrotask(() => setBlocks(parsed))
    }
  }, [content])

  const emitChange = useCallback((newBlocks: NoteBlock[]) => {
    setBlocks(newBlocks)
    const serialized = serializeNoteContent(newBlocks)
    lastContentRef.current = serialized
    onChange(serialized)
  }, [onChange])

  // Click outside to close add menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(null)
        setShowTableCreator(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updateBlock = (index: number, block: NoteBlock) => {
    const next = [...blocks]
    next[index] = block
    emitChange(next)
  }

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return
    const next = blocks.filter((_, i) => i !== index)
    emitChange(next)
  }

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    emitChange(next)
  }

  const insertBlock = (afterIndex: number, block: NoteBlock) => {
    const next = [...blocks]
    next.splice(afterIndex + 1, 0, block)
    emitChange(next)
    setShowAddMenu(null)
    setShowTableCreator(null)
  }

  const addTextBlock = (afterIndex: number) => {
    insertBlock(afterIndex, { type: 'text', content: '' })
  }

  const addTableBlock = (afterIndex: number) => {
    const rows: string[][] = Array.from({ length: tableRows }, () =>
      Array.from({ length: tableCols }, () => '')
    )
    insertBlock(afterIndex, { type: 'table', rows })
    setTableRows(3)
    setTableCols(3)
  }

  // Table operations
  const addTableRow = (blockIndex: number) => {
    const block = blocks[blockIndex] as TableBlock
    const cols = block.rows[0]?.length || 1
    const newRow = Array.from({ length: cols }, () => '')
    updateBlock(blockIndex, { ...block, rows: [...block.rows, newRow] })
  }

  const addTableCol = (blockIndex: number) => {
    const block = blocks[blockIndex] as TableBlock
    const newRows = block.rows.map(row => [...row, ''])
    updateBlock(blockIndex, { ...block, rows: newRows })
  }

  const removeTableRow = (blockIndex: number, rowIndex: number) => {
    const block = blocks[blockIndex] as TableBlock
    if (block.rows.length <= 1) return
    const newRows = block.rows.filter((_, i) => i !== rowIndex)
    updateBlock(blockIndex, { ...block, rows: newRows })
  }

  const removeTableCol = (blockIndex: number, colIndex: number) => {
    const block = blocks[blockIndex] as TableBlock
    if ((block.rows[0]?.length || 0) <= 1) return
    const newRows = block.rows.map(row => row.filter((_, i) => i !== colIndex))
    updateBlock(blockIndex, { ...block, rows: newRows })
  }

  const insertTableRow = (blockIndex: number, afterRowIndex: number) => {
    const block = blocks[blockIndex] as TableBlock
    const cols = block.rows[0]?.length || 1
    const newRow = Array.from({ length: cols }, () => '')
    const newRows = [...block.rows]
    newRows.splice(afterRowIndex + 1, 0, newRow)
    updateBlock(blockIndex, { ...block, rows: newRows })
  }

  const insertTableCol = (blockIndex: number, afterColIndex: number) => {
    const block = blocks[blockIndex] as TableBlock
    const newRows = block.rows.map(row => {
      const newRow = [...row]
      newRow.splice(afterColIndex + 1, 0, '')
      return newRow
    })
    updateBlock(blockIndex, { ...block, rows: newRows })
  }

  const updateCell = (blockIndex: number, rowIndex: number, colIndex: number, value: string) => {
    const block = blocks[blockIndex] as TableBlock
    const newRows = block.rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row
    )
    updateBlock(blockIndex, { ...block, rows: newRows })
  }

  // Toolbar: add block at end
  const [showToolbarTable, setShowToolbarTable] = useState(false)
  const [toolbarRows, setToolbarRows] = useState(3)
  const [toolbarCols, setToolbarCols] = useState(3)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowToolbarTable(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addTableAtEnd = () => {
    const rows: string[][] = Array.from({ length: toolbarRows }, () =>
      Array.from({ length: toolbarCols }, () => '')
    )
    const next = [...blocks, { type: 'table' as const, rows }]
    emitChange(next)
    setShowToolbarTable(false)
    setToolbarRows(3)
    setToolbarCols(3)
  }

  const addTextAtEnd = () => {
    emitChange([...blocks, { type: 'text' as const, content: '' }])
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto min-w-0">
      {/* Toolbar - always visible */}
      {!readOnly && (
        <div className="flex items-center gap-2 pb-3 mb-2 border-b border-gray-100 shrink-0 overflow-x-auto">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mr-1 shrink-0">Thêm:</span>
          <button
            onClick={addTextAtEnd}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:text-sky-700 hover:bg-sky-50 border border-gray-200 hover:border-sky-300 rounded-lg transition-colors cursor-pointer"
          >
            <Type className="w-3.5 h-3.5" />
            Văn bản
          </button>
          <div className="relative" ref={toolbarRef}>
            <button
              onClick={() => setShowToolbarTable(!showToolbarTable)}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors cursor-pointer ${
                showToolbarTable
                  ? 'text-sky-700 bg-sky-50 border-sky-300'
                  : 'text-gray-600 hover:text-sky-700 hover:bg-sky-50 border-gray-200 hover:border-sky-300'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Bảng
            </button>
            {showToolbarTable && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 w-52">
                <p className="text-xs text-gray-500 mb-2 font-medium">Chọn kích thước bảng</p>
                <TableSizeSelector
                  rows={toolbarRows}
                  cols={toolbarCols}
                  onSelect={(r, c) => { setToolbarRows(r); setToolbarCols(c) }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">{toolbarRows} x {toolbarCols}</span>
                  <button
                    onClick={addTableAtEnd}
                    className="ml-auto px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    Tạo bảng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {blocks.map((block, blockIndex) => (
        <div key={blockIndex} className="group/block relative min-w-0">
          {/* Block controls */}
          {!readOnly && blocks.length > 1 && (
            <div className="absolute -left-1 top-1 opacity-0 group-hover/block:opacity-100 transition-opacity flex flex-col items-center gap-0.5 z-10">
              <button
                onClick={() => moveBlock(blockIndex, -1)}
                disabled={blockIndex === 0}
                className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Di chuyển lên"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <GripVertical className="w-3 h-3 text-gray-300" />
              <button
                onClick={() => moveBlock(blockIndex, 1)}
                disabled={blockIndex === blocks.length - 1}
                className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Di chuyển xuống"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Block content */}
          <div className="sm:pl-4 min-w-0">
            {block.type === 'text' ? (
              <TextBlockEditor
                block={block}
                readOnly={readOnly}
                onChange={(b) => updateBlock(blockIndex, b)}
              />
            ) : (
              <TableBlockEditor
                block={block}
                readOnly={readOnly}
                onChange={(b) => updateBlock(blockIndex, b)}
                onAddRow={() => addTableRow(blockIndex)}
                onAddCol={() => addTableCol(blockIndex)}
                onRemoveRow={(ri) => removeTableRow(blockIndex, ri)}
                onRemoveCol={(ci) => removeTableCol(blockIndex, ci)}
                onInsertRow={(ri) => insertTableRow(blockIndex, ri)}
                onInsertCol={(ci) => insertTableCol(blockIndex, ci)}
                onUpdateCell={(ri, ci, v) => updateCell(blockIndex, ri, ci, v)}
              />
            )}
          </div>

          {/* Remove block button */}
          {!readOnly && blocks.length > 1 && (
            <button
              onClick={() => removeBlock(blockIndex)}
              className="absolute -right-1 top-1 opacity-0 group-hover/block:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
              title="Xoá block"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Add block button between blocks */}
          {!readOnly && (
            <div className="relative flex items-center justify-center py-1" ref={showAddMenu === blockIndex ? addMenuRef : undefined}>
              <div className="absolute inset-x-6 top-1/2 border-t border-dashed border-transparent group-hover/block:border-gray-200 transition-colors" />
              <button
                onClick={() => {
                  setShowAddMenu(showAddMenu === blockIndex ? null : blockIndex)
                  setShowTableCreator(null)
                }}
                className="relative z-10 p-1 text-gray-300 hover:text-sky-500 hover:bg-sky-50 rounded-full transition-all opacity-0 group-hover/block:opacity-100 cursor-pointer"
                title="Thêm block"
              >
                <Plus className="w-4 h-4" />
              </button>

              {showAddMenu === blockIndex && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 w-48">
                  <button
                    onClick={() => addTextBlock(blockIndex)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <Type className="w-4 h-4 text-gray-400" />
                    Thêm văn bản
                  </button>
                  <button
                    onClick={() => setShowTableCreator(showTableCreator === blockIndex ? null : blockIndex)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <Table className="w-4 h-4 text-gray-400" />
                    Thêm bảng
                  </button>

                  {showTableCreator === blockIndex && (
                    <div className="border-t border-gray-100 px-3 py-3">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Chọn kích thước bảng</p>
                      <TableSizeSelector
                        rows={tableRows}
                        cols={tableCols}
                        onSelect={(r, c) => { setTableRows(r); setTableCols(c) }}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">{tableRows} x {tableCols}</span>
                        <button
                          onClick={() => addTableBlock(blockIndex)}
                          className="ml-auto px-3 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors cursor-pointer"
                        >
                          Tạo bảng
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

    </div>
  )
}

// --- Text Block Editor ---
function TextBlockEditor({
  block,
  readOnly,
  onChange,
}: {
  block: TextBlock
  readOnly: boolean
  onChange: (block: TextBlock) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, 60) + 'px'
  }, [block.content])

  return (
    <textarea
      ref={ref}
      value={block.content}
      onChange={(e) => onChange({ ...block, content: e.target.value })}
      readOnly={readOnly}
      spellCheck={false}
      className={`w-full text-sm text-gray-700 placeholder-gray-300 focus:outline-none resize-none bg-transparent leading-relaxed font-mono py-2 ${readOnly ? 'cursor-default' : ''}`}
      placeholder={readOnly ? '' : 'Nhập nội dung...'}
      rows={1}
    />
  )
}

// --- Table Block Editor ---
function TableBlockEditor({
  block,
  readOnly,
  onAddRow,
  onAddCol,
  onRemoveRow,
  onRemoveCol,
  onInsertRow,
  onInsertCol,
  onUpdateCell,
}: {
  block: TableBlock
  readOnly: boolean
  onChange: (block: TableBlock) => void
  onAddRow: () => void
  onAddCol: () => void
  onRemoveRow: (rowIndex: number) => void
  onRemoveCol: (colIndex: number) => void
  onInsertRow: (afterRowIndex: number) => void
  onInsertCol: (afterColIndex: number) => void
  onUpdateCell: (rowIndex: number, colIndex: number, value: string) => void
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const numCols = block.rows[0]?.length || 0
  const numRows = block.rows.length

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    if (readOnly) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, row, col })
  }

  return (
    <div className="py-2 min-w-0" ref={tableRef}>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-max min-w-full border-collapse text-sm">
          {/* Column header (numbers) */}
          <thead>
            <tr className="bg-gray-50">
              <th className="w-8 min-w-[32px] border-b border-r border-gray-200 px-1 py-1.5 text-[10px] text-gray-400 font-medium text-center">
                #
              </th>
              {Array.from({ length: numCols }, (_, ci) => (
                <th
                  key={ci}
                  className="border-b border-r border-gray-200 px-2 py-1.5 text-[10px] text-gray-400 font-medium text-center min-w-[80px] relative group/col"
                >
                  <span>{String.fromCharCode(65 + (ci % 26))}{ci >= 26 ? Math.floor(ci / 26) : ''}</span>
                  {!readOnly && numCols > 1 && (
                    <button
                      onClick={() => onRemoveCol(ci)}
                      className="absolute -top-0.5 right-0.5 opacity-0 group-hover/col:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
                      title="Xoá cột"
                    >
                      <MinusCircle className="w-3 h-3" />
                    </button>
                  )}
                </th>
              ))}
              {!readOnly && (
                <th className="w-8 border-b border-gray-200">
                  <button
                    onClick={onAddCol}
                    className="p-1 text-gray-300 hover:text-sky-500 transition-colors cursor-pointer"
                    title="Thêm cột"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="group/row">
                {/* Row number */}
                <td className="border-b border-r border-gray-200 px-1 py-1 text-[10px] text-gray-400 text-center bg-gray-50 relative">
                  <span>{ri + 1}</span>
                  {!readOnly && numRows > 1 && (
                    <button
                      onClick={() => onRemoveRow(ri)}
                      className="absolute -left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
                      title="Xoá hàng"
                    >
                      <MinusCircle className="w-3 h-3" />
                    </button>
                  )}
                </td>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b border-r border-gray-200 p-0 relative"
                    onContextMenu={(e) => handleContextMenu(e, ri, ci)}
                  >
                    {readOnly ? (
                      <div className="px-2 py-1.5 text-sm text-gray-700 min-h-[32px]">
                        {cell || <span className="text-gray-200">&nbsp;</span>}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => onUpdateCell(ri, ci, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:bg-blue-50 bg-transparent min-h-[32px] transition-colors"
                        placeholder=""
                      />
                    )}
                  </td>
                ))}
                {!readOnly && <td className="border-b border-gray-200 w-8" />}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add row button */}
        {!readOnly && (
          <button
            onClick={onAddRow}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-gray-300 hover:text-sky-500 hover:bg-sky-50 transition-colors cursor-pointer text-xs"
            title="Thêm hàng"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Thêm hàng</span>
          </button>
        )}
      </div>

      {/* Table info */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-gray-400">{numRows} hàng x {numCols} cột</span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-[100] py-1 w-44"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => onInsertRow(contextMenu.row)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-gray-400" />
            Chèn hàng bên dưới
          </button>
          <button
            onClick={() => onInsertCol(contextMenu.col)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-gray-400" />
            Chèn cột bên phải
          </button>
          <div className="border-t border-gray-100 my-1" />
          {numRows > 1 && (
            <button
              onClick={() => onRemoveRow(contextMenu.row)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              Xoá hàng {contextMenu.row + 1}
            </button>
          )}
          {numCols > 1 && (
            <button
              onClick={() => onRemoveCol(contextMenu.col)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              Xoá cột {String.fromCharCode(65 + (contextMenu.col % 26))}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --- Table Size Selector (grid picker like Excel) ---
function TableSizeSelector({
  rows,
  cols,
  onSelect,
}: {
  rows: number
  cols: number
  onSelect: (rows: number, cols: number) => void
}) {
  const maxR = 8
  const maxC = 8
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)

  const displayR = hover?.r ?? rows
  const displayC = hover?.c ?? cols

  return (
    <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${maxC}, 1fr)` }}>
      {Array.from({ length: maxR }, (_, r) =>
        Array.from({ length: maxC }, (_, c) => (
          <div
            key={`${r}-${c}`}
            onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(r + 1, c + 1)}
            className={`w-4 h-4 rounded-[3px] border cursor-pointer transition-colors ${
              r + 1 <= displayR && c + 1 <= displayC
                ? 'bg-sky-500 border-sky-500'
                : 'bg-gray-100 border-gray-200 hover:border-gray-300'
            }`}
          />
        ))
      )}
    </div>
  )
}
