import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { userApi } from '@/services/api'

interface ProfilePhotoSectionProps {
  username: string
  currentPhoto?: string | null
  /** Called after a successful upload/removal so the parent can refresh the profile. */
  onChanged: () => void
}

/** Foto profilo: avatar (foto o monogramma), cambia/rimuovi, validazione via usePhotoUpload. */
export function ProfilePhotoSection({ username, currentPhoto, onChanged }: ProfilePhotoSectionProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()

  const { fileInputRef, openPicker, handleFileChange, isReading } = usePhotoUpload({
    onError: (message) => { toast.error(message) },
    onPhotoReady: async (base64) => {
      const result = await userApi.updateProfilePhoto(base64)
      if (result.success) {
        toast.success('Foto profilo aggiornata!')
        onChanged()
      } else {
        toast.error(result.message || "Errore nell'aggiornamento della foto")
      }
    },
  })

  async function handleRemovePhoto() {
    const ok = await confirmDialog({
      title: 'Rimuovi foto',
      message: 'Sei sicuro di voler rimuovere la foto profilo?',
      confirmLabel: 'Rimuovi',
      variant: 'danger',
    })
    if (!ok) return

    const result = await userApi.removeProfilePhoto()
    if (result.success) {
      toast.success('Foto profilo rimossa')
      onChanged()
    } else {
      toast.error(result.message || 'Errore nella rimozione della foto')
    }
  }

  return (
    <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
      <h3 className="micro-label text-gray-400 mb-4">Foto profilo</h3>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={openPicker}
            disabled={isReading}
            className="w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-surface-50/30 hover:border-primary-500/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            aria-label="Cambia foto profilo"
          >
            {currentPhoto ? (
              <img src={currentPhoto} alt="Foto profilo" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-display font-extrabold">
                {username[0]?.toUpperCase() || '?'}
              </span>
            )}
          </button>
          {isReading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={isReading}
              className="min-h-[44px] px-4 rounded-lg border border-surface-50/30 bg-surface-300 text-sm font-semibold text-white hover:bg-surface-100 transition-colors disabled:opacity-50"
            >
              Cambia foto
            </button>
            {currentPhoto && (
              <button
                type="button"
                onClick={() => void handleRemovePhoto()}
                disabled={isReading}
                className="min-h-[44px] px-4 rounded-lg border border-danger-500/40 bg-danger-500/10 text-sm font-semibold text-danger-400 hover:bg-danger-500/20 transition-colors disabled:opacity-50"
              >
                Rimuovi
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500">PNG/JPG, max 500KB</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </section>
  )
}
