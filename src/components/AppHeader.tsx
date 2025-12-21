'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import PricingModal from './PricingModal'
import Logo from './Logo'
import { createClient } from '@/lib/supabase/client'

interface AppHeaderProps {
    userEmail: string
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
    const pathname = usePathname()
    const [isPricingOpen, setIsPricingOpen] = useState(false)
    const [currentPlanId, setCurrentPlanId] = useState<string>('free')

    useEffect(() => {
        (async () => {
            try {
                const supabase = createClient()
                const { data } = await supabase
                    .from('user_subscriptions')
                    .select('plan_id')
                    .maybeSingle()

                if (data?.plan_id) setCurrentPlanId(data.plan_id)
            } catch (e) {
                // opcional: console.warn(e)
            }
        })()
    }, [])

    const navigation = [
        { name: 'Dashboard', href: '/app/dashboard' },
        { name: 'Crear Anuncio', href: '/app/new' },
    ]

    return (
        <nav className="bg-white shadow-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 justify-between">
                    <div className="flex">
                        <div className="flex flex-shrink-0 items-center">
                            <Logo href="/app/dashboard" className="h-8 w-auto" imgClassName="h-8" />
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${pathname === item.href
                                        ? 'border-indigo-500 text-gray-900'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Upgrade Button */}
                        {currentPlanId !== 'agency' && (
                            <button
                                onClick={() => setIsPricingOpen(true)}
                                className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-yellow-500 hover:to-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                                </svg>
                                Mejorar Plan
                            </button>
                        )}

                        {/* User Dropdown */}
                        <Menu as="div" className="relative ml-3">
                            <div>
                                <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                    <span className="sr-only">Open user menu</span>
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                                        <span className="text-xs font-medium leading-none text-gray-700">
                                            {userEmail.charAt(0).toUpperCase()}
                                        </span>
                                    </span>
                                </Menu.Button>
                            </div>
                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-200"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="px-4 py-2 border-b border-gray-100">
                                        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                                    </div>
                                    {currentPlanId !== 'agency' && (
                                        <Menu.Item>
                                            {({ active }: { active: boolean }) => (
                                                <button
                                                    onClick={() => setIsPricingOpen(true)}
                                                    className={`${active ? 'bg-gray-100' : ''} block w-full px-4 py-2 text-left text-sm text-gray-700 sm:hidden`}
                                                >
                                                    ⭐ Mejorar Plan
                                                </button>
                                            )}
                                        </Menu.Item>
                                    )}
                                    <Menu.Item>
                                        {({ active }: { active: boolean }) => (
                                            <Link
                                                href="/app/billing"
                                                className={`${active ? 'bg-gray-100' : ''} block w-full px-4 py-2 text-left text-sm text-gray-700`}
                                            >
                                                Facturación
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }: { active: boolean }) => (
                                            <form action="/auth/signout" method="post">
                                                <button
                                                    type="submit"
                                                    className={`${active ? 'bg-gray-100' : ''} block w-full px-4 py-2 text-left text-sm text-gray-700`}
                                                >
                                                    Salir
                                                </button>
                                            </form>
                                        )}
                                    </Menu.Item>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                </div>
            </div>

            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} currentPlanId={currentPlanId} />
        </nav>
    )
}
