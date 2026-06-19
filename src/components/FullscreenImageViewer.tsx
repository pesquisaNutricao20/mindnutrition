import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

interface FullscreenImage {
  src: string;
  title: string;
  description?: string;
}

interface FullscreenImageViewerProps {
  images: FullscreenImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function FullscreenImageViewer({ images, currentIndex, isOpen, onClose, onNavigate }: FullscreenImageViewerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || images.length === 0) return null;

  const current = images[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors sm:top-6 sm:right-6 sm:w-12 sm:h-12"
          >
            <X size={24} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1); }}
                className="absolute left-3 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors sm:left-6 sm:w-12 sm:h-12"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0); }}
                className="absolute right-3 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors sm:right-6 sm:w-12 sm:h-12"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="max-w-4xl max-h-[86vh] p-2 sm:p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.src}
              alt={current.title}
              className="max-w-full max-h-[68vh] object-contain rounded-lg shadow-2xl sm:max-h-[70vh]"
            />
            {current.title && (
              <h3 className="text-white text-lg font-bold mt-5 text-center sm:text-xl sm:mt-6">{current.title}</h3>
            )}
            {current.description && (
              <p className="text-white/80 text-sm mt-2 text-center max-w-md leading-relaxed">{current.description}</p>
            )}
            {images.length > 1 && (
              <p className="text-white/50 text-xs mt-4">{currentIndex + 1} / {images.length}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MeasurementImageProps {
  key?: React.Key;
  imageSrc: string;
  title: string;
  description: string;
  onClick: () => void;
}

export function MeasurementImageCard({ imageSrc, title, description, onClick }: MeasurementImageProps) {
  return (
    <div className="bg-white border border-line rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group" onClick={onClick}>
      <div className="h-36 w-full relative overflow-hidden bg-accent/5 sm:h-48">
        <img src={imageSrc} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn size={16} className="text-accent" />
        </div>
      </div>
      <div className="p-5">
        <h4 className="font-bold text-lg mb-2">{title}</h4>
        <p className="text-xs text-ink/60 leading-relaxed line-clamp-3">{description}</p>
      </div>
    </div>
  );
}
