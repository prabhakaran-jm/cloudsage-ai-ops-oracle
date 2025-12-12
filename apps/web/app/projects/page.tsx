'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Project } from '@/lib/apiClient';
import Link from 'next/link';
import PlatformBadges from '@/components/PlatformBadges';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getProjects();
      // Dedupe by id in case backend returns both SQL + bucket entries
      const map = new Map<string, Project>();
      for (const p of data.projects || []) {
        if (!map.has(p.id)) {
          map.set(p.id, p);
        }
      }
      setProjects(Array.from(map.values()));
    } catch (err: any) {
      if (err.message.includes('Unauthorized')) {
        router.push('/login');
      } else {
        setError(err.message || 'Failed to load projects');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const data = await apiClient.createProject(
        newProjectName.trim(),
        newProjectDescription.trim() || undefined
      );
      // Dedupe client-side after create
      const map = new Map<string, Project>();
      [...projects, data.project].forEach(p => map.set(p.id, p));
      setProjects(Array.from(map.values()));
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    }
  };

  const handleLogout = async () => {
    await apiClient.logout();
    router.push('/login');
  };

  // Remove the mock risk level function - projects should only show risk if they have actual data

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121121] flex items-center justify-center">
        <div className="text-white/70">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#121121]">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#121121]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[#5048e5]/20 rounded-full blur-[200px]"></div>
      </div>

      <div className="relative z-10 layout-container flex h-full grow flex-col">
        <div className="flex flex-1 justify-center py-5 sm:px-4 md:px-10 lg:px-20 xl:px-40">
          <div className="layout-content-container flex flex-col w-full max-w-[960px] flex-1">
            {/* Header */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-white/10 px-4 sm:px-10 py-3">
              <div className="flex items-center gap-4 text-white">
                <div className="size-6 text-[#5048e5]">
                  <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                  </svg>
                </div>
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">CloudSage</h2>
              </div>
              <div className="flex flex-1 justify-end gap-4 sm:gap-8">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#5048e5] text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2"
                  >
                    <span className="text-base">+</span>
                    <span className="truncate hidden sm:inline">{showCreateForm ? 'Cancel' : 'New Project'}</span>
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-white/10 text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5 hover:bg-white/20"
                    >
                      <span className="text-xl">⚙</span>
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#1a1a2e] border border-white/10 shadow-lg z-50">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              // Add settings functionality here
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10"
                          >
                            Settings
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              handleLogout();
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10"
                          >
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex flex-col flex-1 p-4 sm:p-6">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Your Projects</h1>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex sm:hidden min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#5048e5] text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2"
                >
                  <span className="text-base">+</span>
                  <span className="truncate">{showCreateForm ? 'Cancel' : 'New Project'}</span>
                </button>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {showCreateForm && (
                <form onSubmit={handleCreateProject} className="bg-white/5 border border-white/10 p-6 rounded-lg mb-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent"
                      placeholder="Enter project name"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent"
                      placeholder="Enter project description"
                      rows={3}
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#5048e5] text-white px-4 py-2 rounded-md hover:bg-[#5048e5]/90 font-bold"
                  >
                    Create Project
                  </button>
                </form>
              )}

              {/* Project Cards Grid */}
              {projects.length === 0 ? (
                <div className="flex flex-col px-4 py-16 flex-1 items-center justify-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center justify-center text-[#5048e5]/50">
                      <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="flex max-w-[480px] flex-col items-center gap-2">
                      <p className="text-white text-xl font-bold leading-tight tracking-[-0.015em] max-w-[480px] text-center">No projects yet</p>
                      <p className="text-white/70 text-base font-normal leading-normal max-w-[480px] text-center">Get started by creating your first monitoring project.</p>
                    </div>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#5048e5] text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2"
                    >
                      <span className="text-base">+</span>
                      <span className="truncate">Create Project</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div key={project.id} className="flex flex-col gap-4 p-5 bg-white/5 rounded-lg border border-white/10 transition-all hover:border-[#5048e5]/50 hover:bg-white/10">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-white text-lg font-bold leading-tight">{project.name}</h3>
                        <p className="text-white/60 text-sm font-normal leading-normal">
                          {project.description || 'No description provided'}
                        </p>
                      </div>
                      {/* Badge removed: we can’t accurately state log presence from list response */}
                      <div className="flex-grow"></div>
                      <div className="flex items-center justify-between gap-4 mt-2">
                        <p className="text-white/40 text-xs font-normal">
                          Created: {new Date(project.createdAt).toLocaleString()}
                        </p>
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex min-w-[70px] max-w-[240px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 px-3 bg-[#5048e5]/20 text-white text-sm font-medium leading-normal hover:bg-[#5048e5]"
                        >
                          <span className="truncate">View</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
            
            {/* Platform Branding Footer */}
            <PlatformBadges />
          </div>
        </div>
      </div>
    </div>
  );
}

