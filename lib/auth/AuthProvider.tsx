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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileData) {
          setProfile(profileData)
        } else {
          const newProfile: Partial<Profile> = {
            id: session.user.id,
            email: session.user.email!,
            role: 'user',
          }
          const { data: insertedProfile } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .maybeSingle()

          if (insertedProfile) {
            setProfile(insertedProfile)
          }
        }
      }

      setLoading(false)
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profileData) {
            setProfile(profileData)
          } else {
            const newProfile: Partial<Profile> = {
              id: session.user.id,
              email: session.user.email!,
              role: 'user',
            }
            const { data: insertedProfile } = await supabase
              .from('profiles')
              .insert(newProfile)
              .select()
              .maybeSingle()

            if (insertedProfile) {
              setProfile(insertedProfile)
            }
          }
        } else {
          setProfile(null)
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
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut }}>
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
