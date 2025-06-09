
"use client";

import type { HighScoreEntry } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader as UITableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Award, RotateCcw, TriangleAlert } from "lucide-react";

interface GameOverDialogProps {
  isOpen: boolean;
  score: number;
  highScores: HighScoreEntry[];
  onPlayAgain: () => void;
}

export default function GameOverDialog({
  isOpen,
  score,
  highScores,
  onPlayAgain,
}: GameOverDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => { /* No close on overlay click */ }}>
      <DialogContent 
        className="GameOver sm:max-w-md hud-panel-base p-0"
        style={{
          borderColor: `hsl(var(--destructive-hsl))`,
          boxShadow: `0 0 15px hsl(var(--destructive-hsl)), inset 0 0 10px hsla(var(--destructive-hsl),0.3)`,
        }}
        onInteractOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 items-center border-b" style={{borderColor: `hsla(var(--destructive-hsl),0.3)`}}>
          <TriangleAlert className="w-16 h-16 text-destructive mb-3 filter drop-shadow-[0_0_8px_hsl(var(--destructive-hsl))]"/>
          <DialogTitle className="text-3xl font-headline text-center text-destructive tracking-wider uppercase">Simulation Terminated</DialogTitle>
          <DialogDescription className="text-center text-lg text-muted-foreground font-body">
            Final Score Protocol: <span className="font-bold text-accent">{score}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-6 px-6">
          <h3 className="text-xl font-headline text-center mb-3 text-primary tracking-wide uppercase">Field Operative Rankings</h3>
          {highScores.length > 0 ? (
            <ScrollArea className="h-[200px] rounded-sm border p-1 bg-background/30" style={{borderColor: `hsla(var(--primary-hsl),0.3)`}}>
              <Table>
                <UITableHeader>
                  <TableRow className="border-b-0">
                    <TableHead className="font-headline text-secondary tracking-wider uppercase text-xs">Rank</TableHead>
                    <TableHead className="font-headline text-secondary tracking-wider uppercase text-xs">Score</TableHead>
                    <TableHead className="font-headline text-secondary tracking-wider uppercase text-xs">Date Log</TableHead>
                  </TableRow>
                </UITableHeader>
                <TableBody>
                  {highScores.map((entry, index) => (
                    <TableRow key={index} className="border-0">
                      <TableCell className="font-body text-foreground/90 py-2">{index + 1}</TableCell>
                      <TableCell className="font-body font-bold text-accent py-2">{entry.score}</TableCell>
                      <TableCell className="font-body text-muted-foreground text-xs py-2">{new Date(entry.date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground font-body">No operatives listed. Initiate first contact protocol.</p>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t" style={{borderColor: `hsla(var(--primary-hsl),0.3)`}}>
          <Button 
            onClick={onPlayAgain} 
            className="w-full font-headline bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm border-2 border-primary/70 shadow-[0_0_10px_hsl(var(--primary-hsl)),inset_0_0_5px_hsla(var(--primary-hsl),0.3)]"
            size="lg"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            RE-ENGAGE SIMULATION
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
