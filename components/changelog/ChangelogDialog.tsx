'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { changelog } from '@/lib/constants/changelog';
import { Sparkles, Shield, Wrench, Bug } from 'lucide-react';

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryConfig = {
  feature: {
    label: 'New Feature',
    color: 'bg-blue-500/10 text-blue-700 border-blue-200',
    icon: Sparkles,
  },
  improvement: {
    label: 'Improvement',
    color: 'bg-green-500/10 text-green-700 border-green-200',
    icon: Wrench,
  },
  fix: {
    label: 'Bug Fix',
    color: 'bg-orange-500/10 text-orange-700 border-orange-200',
    icon: Bug,
  },
  security: {
    label: 'Security',
    color: 'bg-purple-500/10 text-purple-700 border-purple-200',
    icon: Shield,
  },
};

export function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            What's New
          </DialogTitle>
          <DialogDescription>
            Track all the features, improvements, and updates to the platform
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-140px)] pr-4">
          <div className="space-y-8">
            {changelog.map((versionGroup, idx) => (
              <div key={versionGroup.version}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                      v{versionGroup.version}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {versionGroup.date}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  {versionGroup.entries.map((entry, entryIdx) => {
                    const config = categoryConfig[entry.category];
                    const Icon = config.icon;
                    
                    return (
                      <div
                        key={`${entry.version}-${entryIdx}`}
                        className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className={`p-2 rounded-md ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-base leading-tight">
                              {entry.title}
                            </h4>
                            <Badge
                              variant="outline"
                              className={`text-xs flex-shrink-0 ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {entry.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {idx < changelog.length - 1 && (
                  <Separator className="my-8" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
