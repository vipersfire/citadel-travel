import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';
export default function ChangedDate({
  label,
  previousDate,
}: {
  label: string;
  previousDate: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="chip neutral" aria-label={`${label}: ${previousDate}`}>
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="date-popover" sideOffset={8}>
          <span>← {previousDate}</span>
          <Popover.Close
            className="icon-button"
            aria-label={
              label.toLowerCase().includes('berubah')
                ? 'Tutup tanggal sebelumnya'
                : 'Close previous date'
            }
          >
            <X size={16} />
          </Popover.Close>
          <Popover.Arrow />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
