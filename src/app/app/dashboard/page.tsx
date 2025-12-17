import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AdActions from './ad-actions'
import TokenCounter from '@/components/TokenCounter'
import ErrorHintBubble from '@/components/ErrorHintBubble'

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : ''
  const pageParam = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
  const PAGE_SIZE = 30

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_id')
    .eq('user_id', user?.id)
    .maybeSingle()

  const planId = subscription?.plan_id || 'free'
  const showWatermarkActions = planId === 'free'

  const { data: sessions } = await supabase
    .from('ad_sessions')
    .select(`
      *,
      render_jobs (
        id,
        status,
        output_url,
        kind,
        error,
        created_at
      ),
      storyboards (summary)
    `)
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })
    .order('created_at', { ascending: false, referencedTable: 'render_jobs' })

  const filtered = (sessions || []).filter((s) => {
    const lastJob = s.render_jobs?.[0]
    const summary = s.storyboards?.summary || s.reference_title || ''
    const tiktok = s.reference_tiktok_url || ''

    const matchesSearch = !search
      || summary.toLowerCase().includes(search.toLowerCase())
      || tiktok.toLowerCase().includes(search.toLowerCase())
      || s.id.toLowerCase().includes(search.toLowerCase())

    return matchesSearch
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginated = filtered.slice(start, end)

  const formatDateTime = (value: string) => {
    const date = new Date(value)
    return `${date.toLocaleString('es-ES', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} UTC`
  }

  const jobIds = paginated
    .map((session) => session.render_jobs?.[0]?.id)
    .filter((id): id is string => Boolean(id))

  const jobCosts = new Map<string, number>()

  if (jobIds.length > 0) {
    const orFilter = jobIds.map((id) => `metadata->>job_id.eq.${id}`).join(',')
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('user_token_ledger')
      .select('change, metadata')
      .or(orFilter)

    if (ledgerError) {
      console.error('Error fetching token ledger', ledgerError)
    } else {
      for (const row of ledgerRows || []) {
        const jobId = typeof row.metadata?.job_id === 'string' ? row.metadata.job_id : null
        if (!jobId) continue
        const current = jobCosts.get(jobId) ?? 0
        jobCosts.set(jobId, current + (row.change ?? 0))
      }
    }
  }

  const getJobCost = (jobId?: string | null, isFailed?: boolean): number | null => {
    if (!jobId) return isFailed ? 0 : null
    const net = jobCosts.get(jobId)
    if (net === undefined) return isFailed ? 0 : null
    return Math.abs(Math.min(net, 0))
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Mis Anuncios
          </h2>
        </div>
        <div className="mt-4 flex items-center gap-4 md:ml-4 md:mt-0">
          <TokenCounter />
          <Link
            href="/app/new"
            className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Nuevo Anuncio
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <form className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
          <div className="flex-1 min-w-0">
            <label className="sr-only" htmlFor="search">Buscar</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.5 3.5a5 5 0 0 1 3.995 8.026l3.24 3.24a.75.75 0 1 1-1.06 1.06l-3.24-3.24A5 5 0 1 1 8.5 3.5Zm-3.75 5a3.75 3.75 0 1 0 7.5 0 3.75 3.75 0 0 0-7.5 0Z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                id="search"
                name="search"
                defaultValue={search}
                placeholder="Buscar por título, TikTok o ID"
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400 bg-white"
              />
            </div>
          </div>
          <div className="flex sm:w-auto justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-gray-200 text-gray-800 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 shrink-0"
            >
              Buscar
            </button>
          </div>
        </form>
      </div>

      <div className="mt-3 flow-root">
        <div className="mt-4 flow-root">
          {/* Mobile View (Cards) */}
          <div className="block sm:hidden space-y-4">
            {paginated.map((session) => {
              const lastJob = session.render_jobs?.[0]
              const summary = session.storyboards?.summary || session.reference_title || 'Sin título'
              const lastError = lastJob?.error
              const isDraft = !lastJob
              const isDone = lastJob && (lastJob.status === 'done' || lastJob.status === 'completed')
              const isProcessing = lastJob?.status === 'processing' || lastJob?.status === 'queued'
              const isFailed = lastJob?.status === 'failed'
              const jobCost = getJobCost(lastJob?.id, isFailed)

              const getFriendlyError = (msg: string | null | undefined): string => {
                if (!msg) return 'No se pudo generar el video.'
                const m = msg.toLowerCase()
                if (m.includes('sensitive') || m.includes('policy') || m.includes('usage') || m.includes('rai')) {
                  return 'Bloqueado por seguridad. Usa texto e imágenes más neutros.'
                }
                if (m.includes('token')) return 'No hay tokens suficientes.'
                if (m.includes('timeout') || m.includes('unavailable') || m.includes('deadline')) {
                  return 'El servicio tardó demasiado. Intenta de nuevo.'
                }
                return 'No se pudo generar el video. Intenta de nuevo.'
              }

              const friendlyError = isFailed ? getFriendlyError(lastError) : null
              return (
                <div key={session.id} className="bg-white shadow rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 max-w-[240px]">{summary}</h3>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{session.reference_tiktok_url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDraft ? (
                      <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        Borrador
                      </span>
                      ) : (
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${isDone ? 'bg-green-50 text-green-700 ring-green-600/20' :
                          isFailed ? 'bg-red-50 text-red-700 ring-red-600/20' :
                            'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                          }`}>
                          {isDone ? 'Generado' : isFailed ? 'Fallido' : 'Procesando'}
                        </span>
                      )}
                      {isFailed && friendlyError && <ErrorHintBubble message={friendlyError} />}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-4">
                    Creado: {formatDateTime(session.created_at)}
                  </div>

                  <div className="border-t pt-3 flex items-center justify-between">
                    <div className="text-[11px] text-gray-500">
                      Coste: {jobCost !== null ? `${jobCost} tokens` : '—'}
                    </div>
                    {isDone && lastJob?.output_url ? (
                      <AdActions outputUrl={lastJob.output_url} hasWatermark={showWatermarkActions} />
                    ) : isProcessing ? (
                      <span className="text-gray-400 italic text-sm">Procesando...</span>
                    ) : isDraft ? (
                      <Link href={`/app/session/${session.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium text-sm">
                        Continuar
                      </Link>
                    ) : isFailed ? (
                      <span className="text-gray-400 text-sm">—</span>
                    ) : (
                      <Link href={`/app/session/${session.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium text-sm">
                        Abrir
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
            {(paginated.length === 0) && (
              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                No tienes anuncios creados. ¡Crea el primero!
              </div>
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden sm:block -mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Referencia
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Estado
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Creado
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Coste
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginated.map((session) => {
                      const lastJob = session.render_jobs?.[0]
                      const summary = session.storyboards?.summary || session.reference_title || 'Sin título'
                      const lastError = lastJob?.error
                      const isDraft = !lastJob
                      const isDone = lastJob && (lastJob.status === 'done' || lastJob.status === 'completed')
                      const isProcessing = lastJob?.status === 'processing' || lastJob?.status === 'queued'
                      const isFailed = lastJob?.status === 'failed'
                      const jobCost = getJobCost(lastJob?.id, isFailed)

                      const getFriendlyError = (msg: string | null | undefined): string => {
                        if (!msg) return 'No se pudo generar el video.'
                        const m = msg.toLowerCase()
                        if (m.includes('sensitive') || m.includes('policy') || m.includes('usage') || m.includes('rai')) {
                          return 'Bloqueado por seguridad. Usa texto e imágenes más neutros.'
                        }
                        if (m.includes('token')) return 'No hay tokens suficientes.'
                        if (m.includes('timeout') || m.includes('unavailable') || m.includes('deadline')) {
                          return 'El servicio tardó demasiado. Intenta de nuevo.'
                        }
                        return 'No se pudo generar el video. Intenta de nuevo.'
                      }

                      const friendlyError = isFailed ? getFriendlyError(lastError) : null
                      return (
                        <tr key={session.id}>
                          <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            <div className="max-w-xs truncate">{summary}</div>
                            <div className="text-gray-500 font-normal text-xs truncate max-w-xs">{session.reference_tiktok_url}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {isDraft ? (
                              <span className="text-gray-400">Borrador</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${isDone ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                  isFailed ? 'bg-red-50 text-red-700 ring-red-600/20' :
                                  'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                                }`}>
                                  {isDone ? 'Generado' : isFailed ? 'Fallido' : 'Procesando'}
                              </span>
                                {isFailed && friendlyError && (
                                  <ErrorHintBubble message={friendlyError} />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatDateTime(session.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {jobCost !== null ? `${jobCost} tokens` : '—'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {isDone && lastJob?.output_url ? (
                              <AdActions outputUrl={lastJob.output_url} hasWatermark={showWatermarkActions} />
                            ) : isProcessing ? (
                              <span className="text-gray-400 italic">Procesando...</span>
                            ) : isDraft ? (
                              <Link href={`/app/session/${session.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium">
                                Continuar
                              </Link>
                            ) : isFailed ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <Link href={`/app/session/${session.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium">
                                Abrir
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {(paginated.length === 0) && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">
                          No tienes anuncios creados. ¡Crea el primero!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-700">
          <div>
            Mostrando {paginated.length > 0 ? `${start + 1}-${Math.min(end, total)}` : '0'} de {total}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`?${new URLSearchParams({
                search,
                page: String(Math.max(1, currentPage - 1))
              }).toString()}`}
              className={`px-3 py-1 rounded-md border text-sm ${currentPage === 1 ? 'text-gray-400 border-gray-200 pointer-events-none' : 'text-indigo-600 border-gray-300 hover:bg-gray-50'}`}
            >
              Anterior
            </Link>
            <span className="text-gray-600">
              Página {currentPage} / {totalPages}
            </span>
            <Link
              href={`?${new URLSearchParams({
                search,
                page: String(Math.min(totalPages, currentPage + 1))
              }).toString()}`}
              className={`px-3 py-1 rounded-md border text-sm ${currentPage === totalPages ? 'text-gray-400 border-gray-200 pointer-events-none' : 'text-indigo-600 border-gray-300 hover:bg-gray-50'}`}
            >
              Siguiente
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
