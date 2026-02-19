import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, FolderOpen, Users, Key } from 'lucide-react';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const features = [
    {
      icon: Terminal,
      title: 'Terminal',
      description: 'Lightweight and powerful terminal emulation for seamless SSH connections.',
    },
    {
      icon: FolderOpen,
      title: 'Organize',
      description: 'Keep your hosts organized and accessible with intuitive grouping.',
    },
    {
      icon: Users,
      title: 'Teams',
      description: 'Collaborate seamlessly with your team on shared SSH configurations.',
    },
    {
      icon: Key,
      title: 'Security',
      description: 'Built-in encryption and key management for secure connections.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header with Icon */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <Terminal className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Welcome to ArchTerm
          </h1>

          <p className="text-lg text-muted-foreground">
            Your powerful SSH client with team collaboration features built in
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Get Started Button */}
        <div className="flex justify-center">
          <Button
            onClick={onComplete}
            size="lg"
            className="w-full sm:w-auto"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
