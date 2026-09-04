export interface PhotoPreset {
  id: string;
  category: 'acai' | 'adicional' | 'b2b';
  title: string;
  url: string;
  thumbnail: string;
}

export const PHOTO_PRESETS: PhotoPreset[] = [
  // AÇAÍ BASE
  {
    id: 'acai-tradicional',
    category: 'acai',
    title: 'Açaí Tradicional na Tigela',
    url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'acai-cuia-paraense',
    category: 'acai',
    title: 'Açaí Grosso na Cuia Paraense',
    url: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'acai-copo',
    category: 'acai',
    title: 'Açaí no Copo Delivery',
    url: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'acai-completo',
    category: 'acai',
    title: 'Açaí Completo com Frutas',
    url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=150&q=70',
  },

  // ADICIONAIS & FRUTAS
  {
    id: 'farinha-tapioca',
    category: 'adicional',
    title: 'Farinha de Tapioca Flocada',
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'banana',
    category: 'adicional',
    title: 'Banana Fatiada',
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'morango',
    category: 'adicional',
    title: 'Morangos Frescos',
    url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'granola',
    category: 'adicional',
    title: 'Granola Crocante',
    url: 'https://images.unsplash.com/photo-1517093707567-9eb548f060f6?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1517093707567-9eb548f060f6?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'leite-ninho',
    category: 'adicional',
    title: 'Leite em Pó (Ninho)',
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'leite-condensado',
    category: 'adicional',
    title: 'Leite Condensado',
    url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'pacoca',
    category: 'adicional',
    title: 'Paçoca de Amendoim',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'nutella',
    category: 'adicional',
    title: 'Nutella / Creme de Avelã',
    url: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=150&q=70',
  },

  // B2B & MATÉRIA-PRIMA
  {
    id: 'saca-acai',
    category: 'b2b',
    title: 'Lata / Paneiro de Açaí (In Natura)',
    url: 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=150&q=70',
  },
  {
    id: 'frutos-frescos',
    category: 'b2b',
    title: 'Frutos de Açaí Selecionados',
    url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=400&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=150&q=70',
  }
];

/**
 * Comprime uma imagem do dispositivo para WebP / JPEG ultraleve (< 40KB) em Data URL
 */
export async function compressImageToDataUrl(file: File, maxWidth = 350, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch (_) {}
        const jpegData = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegData);
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}
