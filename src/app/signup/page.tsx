'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { useTranslations } from '@/lib/hooks/useMarket'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!acceptTerms) {
      setError(t.auth.mustAcceptTerms)
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/app/dashboard')
      router.refresh()
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="h-full bg-white flex items-center py-2.5">
        <div className="w-full flex items-center justify-center lg:max-w-[51%]">
          <div className="w-full max-w-[518px] p-8">
            {/* Logo - Solo visible en móvil */}
            <div className="mx-auto lg:hidden mb-8 flex justify-center">
              <Logo className="h-10 w-auto" imgClassName="h-10" />
            </div>

            {/* Título */}
            <h2 className="text-4xl lg:text-2xl font-semibold text-gray-900 mb-2 text-center lg:text-start">
              {t.auth.signUpTitle}
            </h2>
            <p className="text-gray-600 mb-6 text-center lg:text-start">
              {t.auth.haveAccount}{' '}
              <Link href="/login" className="text-blue-500 hover:underline">
                {t.auth.signInHere}
              </Link>
            </p>

            {/* Botón Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full p-3 rounded-md mb-4 border border-gray-300 text-gray-700 font-medium flex items-center justify-center bg-[#F7F8FA] hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"></path>
                <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"></path>
                <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5818182 23.1818182,9.90909091 L12,9.90909091 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"></path>
                <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"></path>
              </svg>
              {t.auth.registerWithGoogle}
            </button>

            {/* Separador */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300"></span>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t.auth.orContinueWith}</span>
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <input
                  id="email"
                  type="email"
                  placeholder={t.auth.emailAddress}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div>
                <input
                  id="password"
                  type="password"
                  placeholder={t.auth.password}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">{t.auth.minCharacters}</p>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                  {t.auth.acceptTerms}{' '}
                  <Link href="/terms" className="text-blue-600 hover:underline">
                    {t.auth.termsService}
                  </Link>{' '}
                  y la{' '}
                  <Link href="/privacy" className="text-blue-600 hover:underline">
                    {t.auth.privacyPolicy}
                  </Link>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full p-3 rounded-md border border-gray-300 text-gray-700 font-medium flex items-center justify-center bg-[#F7F8FA] hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {loading ? t.auth.creatingAccount : t.auth.createAccountButton}
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-500 text-center">
              {t.auth.byContinuing}{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">
                {t.auth.terms}
              </Link>{' '}
              y{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                {t.auth.privacy}
              </Link>
            </p>
          </div>
        </div>

        {/* Panel derecho - Solo visible en desktop */}
        <div className="bg-white w-[49%] lg:flex flex-col items-center rounded-xl hidden h-screen relative overflow-hidden p-2">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-lg h-full w-full relative overflow-hidden flex flex-col justify-between p-8">
            {/* Logo */}
            <div className="flex justify-start">
              <Logo className="h-14 w-auto drop-shadow-lg" imgClassName="h-14" />
            </div>

            {/* Contenido central */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-white">
                <h3 className="text-4xl font-light mb-4 leading-tight">
                  {t.auth.signupTagline}
                </h3>
                <p className="text-xl text-white/80 font-light">
                  {t.hero.subtitle}
                </p>
              </div>
            </div>

            {/* Testimonio */}
            <div className="text-left">
              <blockquote className="text-white text-2xl leading-tight font-light mb-4">
                {t.auth.signupTestimonial}
              </blockquote>
              <div className="text-white/70 text-lg font-light">
                <span className="font-normal">Carlos</span>
                <span className="ml-2">- CEO, Ecommerce</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
