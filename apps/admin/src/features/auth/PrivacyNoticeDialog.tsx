import { Dialog } from '@yewdiel21/motion-kit/react';

/**
 * Aviso de privacidad (BORRADOR). El texto definitivo debe validarlo el área jurídica de SEMUJERES (Q-47).
 */
export function PrivacyNoticeDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="mk-button mk-button--text mk-button--sm">Aviso de privacidad</Dialog.Trigger>
      <Dialog.Content size="md">
        <Dialog.Header>
          <Dialog.Title>Aviso de privacidad simplificado</Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>
        <Dialog.Body>
          <div className="grid gap-3 text-sm leading-relaxed text-on-surface-variant">
            <p className="rounded-2xl bg-tertiary-container px-3 py-2 text-on-tertiary-container">
              Borrador para el prototipo. Pendiente de validación jurídica.
            </p>
            <p>
              Los datos personales tratados en este sistema se usan exclusivamente para brindar atención, orientación
              y seguimiento a las personas usuarias de la Secretaría de las Mujeres, y para generar estadísticas
              agregadas que no permiten identificar a nadie.
            </p>
            <p>
              El acceso está restringido al personal autorizado. Cada consulta y cambio queda registrado en una
              bitácora de auditoría. La información se transmite cifrada.
            </p>
            <p>
              Durante el hackathon, el sistema funciona únicamente con <strong>datos sintéticos</strong>.
            </p>
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
