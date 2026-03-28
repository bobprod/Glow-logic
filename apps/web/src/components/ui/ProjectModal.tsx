"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, FolderOpen, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import useStore from '../../store/useStore';

interface ProjectModalProps {
    onClose: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ onClose }) => {
    const {
        availableProjects,
        fetchProjects,
        saveProject,
        loadProject,
        currentProjectName
    } = useStore();

    const [projectName, setProjectName] = useState(currentProjectName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleSave = async () => {
        if (!projectName.trim()) return;
        setIsSaving(true);
        await saveProject(projectName);
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => {
            setSaveSuccess(false);
            onClose(); // Ferme automatiquement après la sauvegarde pour revenir au dashboard
        }, 1200);
    };

    const handleLoad = async (id: number) => {
        await loadProject(id);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-[#0f1218]/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-xl">
                            <Save className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Project Management</h2>
                            <p className="text-xs text-slate-400">Save and load your Glow Logic setups</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Save Current Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span>Save Current Project</span>
                        </h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="Project Name..."
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                            />
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !projectName.trim()}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${saveSuccess
                                    ? 'bg-green-500 text-white'
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black animate-spin rounded-full" />
                                ) : saveSuccess ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                {saveSuccess ? 'SAVED' : 'SAVE'}
                            </button>
                        </div>
                    </div>

                    {/* Load Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                            Available Projects
                        </h3>

                        <div className="grid gap-3">
                            {availableProjects.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                                    <FolderOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500">No saved projects found</p>
                                </div>
                            ) : (
                                availableProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl p-4 flex items-center justify-between transition-all cursor-pointer"
                                        onClick={() => handleLoad(project.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                                <FolderOpen className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold">{project.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    <span>Last modified: {new Date(project.updated_at).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Handle delete logic here or via store
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <div className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-[10px] font-black rounded-full uppercase tracking-widest border border-cyan-500/30">
                                                Load Project
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Tips */}
                <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between px-6">
                    <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">
                        SQLite Database (Local)
                    </p>
                    <button
                        onClick={onClose}
                        className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center gap-2"
                    >
                        <span>Retours au Dashboard</span>
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};
