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
    const [tokenBalance, setTokenBalance] = useState<number>(0)

    useEffect(() => {
        (async () => {
            try {
                const supabase = createClient()
                
                // Fetch plan
                const { data: subData } = await supabase
                    .from('user_subscriptions')
                    .select('plan_id')
                    .maybeSingle()

                if (subData?.plan_id) setCurrentPlanId(subData.plan_id)

                // Fetch token balance
                const { data: balanceData } = await supabase
                    .from('user_token_balances')
                    .select('balance')
                    .maybeSingle()

                if (balanceData?.balance !== undefined) setTokenBalance(balanceData.balance)
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
                        {/* Token Balance */}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-indigo-600">
                                <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.202.592.037.051.08.102.128.152z" />
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-6a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.33.744.74.925 1.2a.75.75 0 01-1.395.55 1.35 1.35 0 00-.447-.563 2.187 2.187 0 00-.736-.363V9.3c.698.093 1.383.32 1.959.696.787.514 1.29 1.27 1.29 2.13 0 .86-.504 1.616-1.29 2.13-.576.377-1.261.603-1.96.696v.299a.75.75 0 11-1.5 0v-.3c-.697-.092-1.382-.318-1.958-.695-.482-.315-.857-.717-1.078-1.188a.75.75 0 111.359-.636c.08.173.245.376.54.569.313.205.706.353 1.138.432v-2.748a3.782 3.782 0 01-1.653-.713C6.9 9.433 6.5 8.681 6.5 7.875c0-.805.4-1.558 1.097-2.096a3.78 3.78 0 011.653-.713V4.75A.75.75 0 0110 4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-900">{tokenBalance}</span>
                        </div>

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

            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
        </nav>
    )
}
