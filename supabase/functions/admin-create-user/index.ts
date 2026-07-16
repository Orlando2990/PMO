import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  let createdUserId: string | null = null

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authHeader = req.headers.get('Authorization')

    if (!supabaseUrl || !anonKey || !serviceRole) {
      return jsonResponse({ error: 'La función no tiene disponibles las variables de Supabase.' }, 500)
    }
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'No se recibió una sesión válida.' }, 401)
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    const caller = userData?.user
    if (userError || !caller) {
      return jsonResponse({ error: 'La sesión expiró o no es válida.' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: callerProfile, error: profileError } = await adminClient
      .from('pmo_user_profiles')
      .select('rol, activo')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error consultando perfil administrador:', profileError)
      return jsonResponse({ error: 'No fue posible validar el perfil del administrador.' }, 500)
    }
    if (!callerProfile || callerProfile.rol !== 'administrador' || callerProfile.activo === false) {
      return jsonResponse({ error: 'Solo un administrador activo puede crear usuarios.' }, 403)
    }

    const payload = await req.json().catch(() => null)
    const nombre = String(payload?.nombre ?? '').trim()
    const correo = String(payload?.correo ?? '').trim().toLowerCase()
    const rol = String(payload?.rol ?? '').trim().toLowerCase()
    const password = String(payload?.password ?? '')
    const activo = payload?.activo !== false
    const rolesPermitidos = ['usuario', 'pmo', 'direccion', 'administrador']

    if (!nombre || !correo || !password || !rolesPermitidos.includes(rol)) {
      return jsonResponse({ error: 'Completa nombre, correo, rol y contraseña temporal.' }, 400)
    }
    if (!correo.endsWith('@finsus.mx')) {
      return jsonResponse({ error: 'El correo debe pertenecer al dominio corporativo @finsus.mx.' }, 400)
    }
    if (password.length < 8) {
      return jsonResponse({ error: 'La contraseña temporal debe tener al menos 8 caracteres.' }, 400)
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    })

    if (createError) {
      console.error('Error creando Authentication user:', createError)
      const duplicate = /already|registered|exists/i.test(createError.message)
      return jsonResponse(
        { error: duplicate ? 'Ya existe una cuenta registrada con ese correo.' : createError.message },
        duplicate ? 409 : 400,
      )
    }

    createdUserId = created.user?.id ?? null
    if (!createdUserId) return jsonResponse({ error: 'Supabase no devolvió el ID del usuario creado.' }, 500)

    const { error: profileInsertError } = await adminClient
      .from('pmo_user_profiles')
      .upsert({
        user_id: createdUserId,
        nombre,
        correo,
        rol,
        activo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (profileInsertError) {
      console.error('Error creando pmo_user_profiles:', profileInsertError)
      await adminClient.auth.admin.deleteUser(createdUserId)
      return jsonResponse({ error: `No se pudo crear el perfil: ${profileInsertError.message}` }, 500)
    }

    return jsonResponse({
      ok: true,
      user_id: createdUserId,
      message: 'Usuario y perfil creados correctamente.',
    }, 201)
  } catch (error) {
    console.error('Error inesperado en admin-create-user:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
