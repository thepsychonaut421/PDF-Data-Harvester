import type { FC } from 'react';
import { Sheet } from 'lucide-react';

interface AppHeaderProps {
  appName: string;
}

const AppHeader: FC<AppHeaderProps> = ({ appName }) => {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <Sheet className="h-8 w-8 text-primary mr-3" />
        <h1 className="text-2xl font-bold text-primary">{appName}</h1>
      </div>
    </header>
  );
};

export default AppHeader;
