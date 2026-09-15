import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'commercials';

async function ensureBucket(supabase: any) {
  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      console.warn('Aviso ao listar buckets:', listErr.message);
      return;
    }
    const exists = buckets?.some((b: any) => b.name === BUCKET_NAME || b.id === BUCKET_NAME);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true
      });
      if (createErr) {
        console.warn('Aviso ao criar bucket commercials:', createErr.message);
      }
    }
  } catch (err: any) {
    console.warn('Erro ao verificar/criar bucket:', err.message);
  }
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    await ensureBucket(supabase);

    const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list('ads', {
      limit: 60,
      sortBy: { column: 'created_at', order: 'desc' }
    });

    if (error) {
      return NextResponse.json({ success: true, files: [] });
    }

    const formattedFiles = (files || [])
      .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
      .map(f => {
        const filePath = `ads/${f.name}`;
        const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
        const isVideo = /\.(mp4|webm|mov|ogg|m4v)$/i.test(f.name);
        return {
          id: f.id || f.name,
          name: f.name,
          path: filePath,
          url: publicUrl,
          mediaType: isVideo ? 'video' : 'image',
          size: f.metadata?.size || 0,
          createdAt: f.created_at || f.updated_at || new Date().toISOString()
        };
      });

    return NextResponse.json({
      success: true,
      files: formattedFiles
    });
  } catch (error: any) {
    console.error('Erro GET /api/admin/media-upload:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar mídias' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Formato não suportado. Envie uma imagem (JPG, PNG, WebP, GIF) ou vídeo (MP4, WebM).' },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'O arquivo excede o limite máximo permitido de 50MB.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await ensureBucket(supabase);

    const origExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : (isImage ? '.jpg' : '.mp4');
    const baseSlug = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '_')
      .substring(0, 30);

    const fileName = `ads/${Date.now()}_${baseSlug || 'midia'}${origExt.toLowerCase()}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '31536000'
    });

    if (uploadError) {
      console.error('Erro no upload para Supabase Storage:', uploadError);
      return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      storagePath: fileName,
      mediaType: isVideo ? 'video' : 'image',
      mimeType,
      size: file.size
    });
  } catch (error: any) {
    console.error('Erro POST /api/admin/media-upload:', error);
    return NextResponse.json({ error: error.message || 'Falha no processamento do upload' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { path } = await request.json();
    if (!path) {
      return NextResponse.json({ error: 'Caminho do arquivo não fornecido.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Mídia removida com sucesso.' });
  } catch (error: any) {
    console.error('Erro DELETE /api/admin/media-upload:', error);
    return NextResponse.json({ error: error.message || 'Falha ao remover mídia' }, { status: 500 });
  }
}
