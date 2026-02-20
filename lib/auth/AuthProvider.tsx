'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  authMethod: 'email' | 'phone' | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authMethod, setAuthMethod] = useState<'email' | 'phone' | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted) return

        if (session?.user) {
          setSession(session)
          setUser(session.user)

          // Load profile with mounted check to prevent race condition
          const userId = session.user.id
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
            .then(({ data: profileData, error }: { data: any; error: any }) => {
              // Check if component is still mounted and user hasn't changed
              if (!isMounted) return
              
              if (error) {
                console.error('Error loading profile:', error)
                return
              }

              if (profileData) {
                setProfile(profileData)
                setAuthMethod(profileData.auth_method as 'email' | 'phone')
              }
            })
        }
      } catch (error) {
        console.error('Error loading session:', error)
      } finally {
        // Set loading to false immediately after session check
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      (async () => {
        if (!isMounted) return

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          const userId = session.user.id
          const { data: profileData, error }: { data: any; error: any } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()

          // Check if component is still mounted before updating state
          if (!isMounted) return

          if (error) {
            console.error('Error loading profile:', error)
          }

          if (profileData) {
            setProfile(profileData)
            setAuthMethod(profileData.auth_method as 'email' | 'phone')
          } else {
            setProfile(null)
            setAuthMethod(null)
          }

          // After a fresh sign-in, claim any pending call the guest recorded
          if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
            const pendingCallId = localStorage.getItem('pendingCallId')
            if (pendingCallId) {
              localStorage.removeItem('pendingCallId')
              try {
                await fetch(`/api/calls/${pendingCallId}/claim`, { method: 'POST' })
              } catch (err) {
                console.error('[AuthProvider] Failed to claim pending call:', err)
              }
              // Redirect to sessions so the user sees their new session
              window.location.href = '/sessions'
              return
            }
          }
        } else {
          setProfile(null)
          setAuthMethod(null)
        }

        if (isMounted) {
          setLoading(false)
        }
      })()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
    setAuthMethod(null)
  }

  const refreshProfile = async () => {
    if (!user) return
    
    const { data: profileData, error }: { data: any; error: any } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error refreshing profile:', error)
      return
    }

    if (profileData) {
      setProfile(profileData)
      setAuthMethod(profileData.auth_method as 'email' | 'phone')
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile, authMethod }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
