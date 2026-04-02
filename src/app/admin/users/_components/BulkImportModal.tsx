'use client';

import { useState, useRef } from 'react';
import { CloudUploadIcon, Download01Icon, Cancel01Icon, Tick01Icon } from 'hugeicons-react';
import { toast } from 'sonner';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const generateTemplate = () => {
        // Create an empty CSV template but with .xlsx MIME data in the backend, or just CSV as template.
        // It's much simpler to give a simple CSV that can be saved as XLSX by the user, or let's create a minimal CSV that xlsx dependency handles perfectly.
        const csvContent = "data:text/csv;charset=utf-8," 
            + "username,full_name,password,gender\n"
            + "user1@example.com,Budi Santoso,mypassword123,L\n"
            + "user2@example.com,Siti Aminah,mypassword456,P\n";
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Template_Import_Peserta.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/users/import', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.success) {
                toast.success(data.message);
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || 'Gagal mengimpor data');
            }
        } catch (error) {
            console.error(error);
            toast.error('Terjadi kesalahan koneksi saat mengimpor.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Import Massal Pengguna</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <Cancel01Icon size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                        <h4 className="text-sm font-bold text-blue-800 mb-1">Panduan Format File (Excel/CSV)</h4>
                        <ul className="list-disc list-inside text-xs text-blue-700/80 space-y-1 mb-3">
                            <li>Baris pertama harus berisi header (akan diabaikan).</li>
                            <li>Kolom A: Username / Email</li>
                            <li>Kolom B: Nama Lengkap</li>
                            <li>Kolom C: Password Akun</li>
                            <li>Kolom D: Gender (L/P)</li>
                        </ul>
                        <button 
                            onClick={generateTemplate}
                            className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1.5 w-max"
                        >
                            <Download01Icon size={14} /> Download Template
                        </button>
                    </div>

                    <div 
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-primary/50'}`}
                    >
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        
                        {!file ? (
                            <div className="flex flex-col items-center">
                                <CloudUploadIcon size={36} className="text-slate-400 mb-3" />
                                <p className="text-sm font-medium text-slate-600">Pilih file Excel atau CSV</p>
                                <p className="text-xs text-slate-400 mt-1">Hanya mendukung format .xlsx, .xls, .csv</p>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition"
                                >
                                    Browse File
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                                    <Tick01Icon size={24} />
                                </div>
                                <p className="text-sm font-bold text-emerald-800">{file.name}</p>
                                <p className="text-xs text-emerald-600/70 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                                <button 
                                    onClick={() => setFile(null)}
                                    className="mt-3 text-xs text-slate-500 underline hover:text-slate-700"
                                >
                                    Ganti File
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl disabled:opacity-50 transition shadow-sm flex items-center gap-2"
                    >
                        {isUploading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : <CloudUploadIcon size={18} />}
                        {isUploading ? 'Mengimpor...' : 'Mulai Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
