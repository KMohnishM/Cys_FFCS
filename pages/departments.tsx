import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import type { Department } from '../types'
import Navigation from '../components/Navigation'

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [persistedSelection, setPersistedSelection] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const db = getDbClient()
    const unsub = auth.onAuthStateChanged(async (u: any | null) => {
      setUserId(u?.uid ?? null)
      if (u) {
        const { doc, getDoc } = await import('firebase/firestore')
        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        setUserRole(userSnap.exists() ? (userSnap.data() as any).role : null)
      } else {
        setUserRole(null)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const db = getDbClient()
    const col = collection(db, 'departments')
    const q = query(col)
    const unsub = onSnapshot(q, (snap) => {
      const list: Department[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        list.push({ deptId: d.id, name: data.name, capacity: data.capacity, filledCount: data.filledCount || 0 })
      })
      setDepartments(list)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!userId) return
    const db = getDbClient()
    ;(async () => {
      const { doc, getDoc } = await import('firebase/firestore')
      const uref = doc(db, 'users', userId)
      const snap = await getDoc(uref)
      if (snap.exists()) {
        const data = snap.data() as any
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          setSelected(data.departments)
          setPersistedSelection(data.departments)
          if (data.departments.length >= 2) {
            setLocked(true)
          }
        }
      }
    })()
  }, [userId])

  const toggle = (id: string) => {
    if (locked) return
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const confirm = async () => {
  if (!userId) return alert('Sign in required')
  if (selected.length !== 2) return alert('Choose exactly two departments')
    setLoading(true)
    const db = getDbClient()
    try {
      const added = selected.filter((id) => !persistedSelection.includes(id))
      const removed = persistedSelection.filter((id) => !selected.includes(id))

      await runTransaction(db, async (tx) => {
        const touchedIds = Array.from(new Set([...selected, ...persistedSelection]))
        const departmentDocs = new Map<string, { ref: any; filled: number; cap: number }>()

        for (const id of touchedIds) {
          const dref = doc(db, 'departments', id)
          const dsnap = await tx.get(dref)
          if (!dsnap.exists()) throw new Error('Department missing')
          const data = dsnap.data() as any
          departmentDocs.set(id, {
            ref: dref,
            filled: data.filledCount || 0,
            cap: data.capacity || 0,
          })
        }

        for (const id of added) {
          const info = departmentDocs.get(id)
          if (!info) continue
          if (info.cap > 0 && info.filled + 1 > info.cap) throw new Error(`Department ${id} full`)
          info.filled += 1
        }

        for (const id of removed) {
          const info = departmentDocs.get(id)
          if (!info) continue
          info.filled = Math.max(0, info.filled - 1)
        }

        const uref = doc(db, 'users', userId)

        for (const info of departmentDocs.values()) {
          tx.update(info.ref, { filledCount: info.filled })
        }
        tx.update(uref, { departments: selected })
      })

      setPersistedSelection(selected)
      setLocked(true)
    } catch (e: any) {
      console.error(e)
      alert(e.message || 'Failed to save selection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation userRole={userRole} />
      <main className="page-shell py-8 sm:py-10">
        <div className="ascii-stack gap-6">
          <header className="space-y-2 text-center sm:text-left">
            <h1 className="ascii-title text-2xl sm:text-3xl">Department Selection</h1>
            <hr className="ascii-rule" />
            <p className="ascii-footnote text-xs sm:text-sm">Select exactly two departments. Lock-in is final.</p>
          </header>

          <section className="grid gap-3 sm:grid-cols-2">
            {departments.map((dept) => {
              const isSelected = selected.includes(dept.deptId)
              const isFull = dept.capacity > 0 && dept.filledCount >= dept.capacity
              const disabled = (isFull && !isSelected) || locked

              return (
                <button
                  type="button"
                  key={dept.deptId}
                  onClick={() => {
                    if (!disabled) toggle(dept.deptId)
                  }}
                  className={`ascii-card text-left space-y-3 transition-transform hover:translate-y-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
                  <div className="space-y-2">
                    <p className="ascii-meta text-xs sm:text-sm">{dept.deptId}</p>
                    <h2 className="text-lg sm:text-xl uppercase tracking-[0.16em] sm:tracking-[0.18em]">{dept.name}</h2>
                    <p className="ascii-footnote text-xs sm:text-sm">
                      Seats {String(dept.filledCount).padStart(2, '0')} / {dept.capacity || '∞'}
                    </p>
                    <div className="ascii-tag text-[11px] sm:text-xs">
                      {isSelected ? 'Selected' : isFull ? 'Full' : 'Available'}
                    </div>
                  </div>
                  <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
                </button>
              )
            })}
          </section>

          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard" className="ascii-button flex-1 text-center text-[11px] sm:text-xs py-3">
                Back To Dashboard
              </Link>
              <button
                onClick={confirm}
                disabled={locked || loading || selected.length !== 2}
                className="ascii-button flex-1 text-center text-[11px] sm:text-xs py-3"
              >
                {locked ? 'Selection Locked' : loading ? 'Processing...' : 'Lock In Departments'}
              </button>
            </div>
            {!locked && selected.length !== 2 && (
              <p className="ascii-footnote text-xs sm:text-sm">Choose two departments before locking in.</p>
            )}
            {locked && <p className="ascii-footnote text-xs sm:text-sm">Contact an admin to request changes.</p>}
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          <footer className="ascii-footnote text-center uppercase tracking-[0.18em]">
            Departments feed project availability.
          </footer>
        </div>
      </main>
    </div>
  )
}
