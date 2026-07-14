'use client';

import {useState} from 'react';

export default function ContactInfo() {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText('0343335657').then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div className="px-4 pb-4 flex items-center gap-3">
            <span className="text-[10px] text-gray-300 font-semibold">Ver1.1</span>
            <button
                onClick={copy}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-sky-600 transition-colors cursor-pointer"
                title="Nhấn để sao chép"
            >
                <span>{copied ? '✅' : '📞'}</span>
                <span className="text-[10px]">{copied ? 'Đã sao chép!' : '0343 335 657'}</span>
            </button>
        </div>
    );
}
