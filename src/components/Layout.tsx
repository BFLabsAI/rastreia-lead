import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
    children: ReactNode;
    currentPath: string;
    onNewLead: () => void;
}

export function Layout({ children, currentPath, onNewLead }: LayoutProps) {
    return (
        <div className="min-h-screen bg-[#050505] text-gray-100 flex">
            {/* Sidebar - Fixed positioning */}
            <Sidebar currentPath={currentPath} />

            {/* Main Content - Starts immediately after sidebar */}
            <main className="flex-1 ml-64">
                <div className="px-8 py-6">
                    <Header onNewLead={onNewLead} />
                    {children}
                </div>
            </main>
        </div>
    );
}
