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
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          setSession(session)
          setUser(session.user)

          // Load profile in parallel (don't block on it)
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data: profileData, error }) => {
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
        setLoading(false)
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

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
        } else {
          setProfile(null)
          setAuthMethod(null)
        }

        setLoading(false)
      })()
    })

    return () => {
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
    
    const { data: profileData, error } = await supabase
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
