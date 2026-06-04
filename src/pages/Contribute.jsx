import React, { useState, useRef } from 'react'
import './Contribute.css'

// Sign up at formspree.io, create a form, and replace this with your form ID
const FORMSPREE_ID = 'mgobvvor'

export default function Contribute() {
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [files, setFiles] = useState([])
  const fileInputRef = useRef(null)

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')

    // Formspree free tier does not support file attachments.
    // Submit text fields as JSON; files are noted in the message instead.
    const data = {
      name: e.target.name.value,
      email: e.target.email.value,
      phone: e.target.phone.value,
      message: e.target.message.value,
      _subject: `Pharaohs site submission from ${e.target.name.value}`,
    }

    if (files.length > 0) {
      data.message += `\n\n[Attachments: ${files.map(f => f.name).join(', ')} — please reply to this email and the submitter can send files directly]`
    }

    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (res.ok) {
        setStatus('success')
        e.target.reset()
        setFiles([])
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="page-container contribute-page">
      <h1 className="page-title">Contribute</h1>
      <p className="page-subtitle">Share photos, updates, stories, or anything else with the team</p>

      {status === 'success' ? (
        <div className="contribute-success card">
          <div className="card-body success-body">
            <div className="success-icon">✅</div>
            <h2>Submitted!</h2>
            <p>Thanks — your contribution has been sent to the team admin.</p>
            <button className="submit-btn" onClick={() => setStatus('idle')} style={{ marginTop: 20 }}>
              Submit Another
            </button>
          </div>
        </div>
      ) : (
        <form className="contribute-form card" onSubmit={handleSubmit} encType="multipart/form-data">
          <div className="card-body">
            {FORMSPREE_ID === 'YOUR_FORMSPREE_ID' && (
              <div className="setup-notice">
                ⚠️ To enable form submissions, sign up at <a href="https://formspree.io" target="_blank" rel="noopener noreferrer">formspree.io</a>, create a form pointed at <strong>mberghold10@gmail.com</strong>, and replace <code>YOUR_FORMSPREE_ID</code> in <code>Contribute.jsx</code>.
              </div>
            )}

            <div className="form-row form-row--2">
              <div className="form-group">
                <label className="form-label" htmlFor="name">Name <span className="required">*</span></label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="form-input"
                  required
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-input"
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="form-input"
                placeholder="(555) 555-5555"
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                className="form-input form-textarea"
                rows={5}
                placeholder="Share a story, photo caption, stat correction, game recap..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attachments</label>
              <div
                className="file-drop-zone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  setFiles(Array.from(e.dataTransfer.files))
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFiles}
                  style={{ display: 'none' }}
                />
                <div className="file-drop-icon">📎</div>
                <p className="file-drop-text">
                  {files.length > 0
                    ? files.map(f => f.name).join(', ')
                    : 'Click or drag files here — photos, videos, documents'}
                </p>
              </div>
              <p className="file-note">
                Note: file names will be included in the submission. The team admin will follow up to collect the actual files.
              </p>
            </div>

            {status === 'error' && (
              <div className="error">Something went wrong. Please try again or email mberghold10@gmail.com directly.</div>
            )}

            <button
              type="submit"
              className="submit-btn"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Sending...' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
