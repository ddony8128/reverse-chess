import { AnimatePresence, motion } from 'framer-motion';

interface CheckIndicatorProps {
  text: string | null;
}

export function CheckIndicator({ text }: CheckIndicatorProps) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -4 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="bg-primary/40 absolute inset-0 rounded-full blur-lg" />

            {/* Main badge */}
            <div className="border-primary/80 bg-primary relative rounded-full border-2 px-4 py-1 shadow-lg">
              <span className="text-primary-foreground text-sm font-semibold tracking-wide drop-shadow-md sm:text-lg">
                {text}
              </span>
            </div>

            {/* Animated pulse ring */}
            <motion.div
              className="border-primary/60 absolute inset-0 rounded-full border-2"
              animate={{ scale: [1, 1.2], opacity: [0.6, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
