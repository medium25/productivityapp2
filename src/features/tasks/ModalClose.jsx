import { useTranslation } from 'react-i18next'
import { IconClose } from '../../icons/Icons'

// Round dark close button in a task dialog's top-right corner (per user
// request — leaving a window has to be obvious, not only a click on the
// backdrop). Sits inside .task-modal, which is position: relative.
export default function ModalClose({ onClick }) {
  const { t } = useTranslation()
  return (
    <button type="button" className="modal-close" onClick={onClick} aria-label={t('tasksHub.close')} title={t('tasksHub.close')}>
      <IconClose size={16} />
    </button>
  )
}
