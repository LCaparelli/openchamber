import * as React from 'react';

import { Icon } from '@/components/icon/Icon';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { dropdownTriggerVariants } from '@/components/ui/dropdown-trigger';
import { shouldDismissDropdown } from '@/components/ui/dropdown-navigation';
import { MobileOverlayPanel } from '@/components/ui/MobileOverlayPanel';
import { MobileSheetRow, MobileSheetSearch } from '@/components/ui/MobileSheetList';
import type { Session } from '@/lib/opencode/model';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useSessionPinnedStore } from '@/stores/useSessionPinnedStore';
import { compareSessionsByLifecycleOrder, useSessionOrderingStore } from '@/sync/session-ordering';
import { scheduledTaskTargetResults, type ScheduledTaskTargetRow } from './scheduledTaskTargetResults';

export function ScheduledTaskTargetPicker({ value, eligible, known, load, isMobile, onSelect }: {
  value: string;
  eligible: readonly Session[];
  known: readonly Session[];
  load: 'loading' | 'error' | 'ready';
  isMobile: boolean;
  onSelect: (sessionId: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const pinnedSessionIds = useSessionPinnedStore((state) => state.ids);
  const rankById = useSessionOrderingStore((state) => state.rankById);

  const shownResults = React.useRef<ReturnType<typeof scheduledTaskTargetResults>>({ selected: null, rows: [], more: false });
  const results = React.useMemo(() => {
    if (!open) return shownResults.current;
    shownResults.current = scheduledTaskTargetResults({
      eligible,
      known,
      query,
      selectedId: value,
      compare: (left, right) => compareSessionsByLifecycleOrder(left, right, pinnedSessionIds, rankById),
    });
    return shownResults.current;
  }, [open, eligible, known, query, value, pinnedSessionIds, rankById]);
  const rows = results.selected ? [results.selected, ...results.rows] : results.rows;
  const status = load === 'loading'
    ? t('common.loading')
    : load === 'error'
      ? t('sessions.scheduledTasks.editor.targetLoadFailed')
      : rows.length > 0
        ? null
        : query.trim()
          ? t('sessions.scheduledTasks.editor.target.noMatch')
          : results.more ? null : t('sessions.scheduledTasks.editor.target.empty');
  const moreHint = load === 'ready' && results.more ? t('sessions.scheduledTasks.editor.target.keepTyping') : null;
  const selectedTitle = value ? known.find((session) => session.id === value)?.title.trim() || value : '';

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };
  const choose = (sessionId: string) => {
    onSelect(sessionId);
    changeOpen(false);
  };
  const subagentLabel = (row: ScheduledTaskTargetRow) => (row.parentTitle
    ? t('sessions.scheduledTasks.editor.target.subagentOf', { parent: row.parentTitle })
    : t('sessions.scheduledTasks.editor.target.subagent'));
  const trigger = (
    <button
      type="button"
      onClick={isMobile ? () => changeOpen(true) : undefined}
      aria-haspopup={isMobile ? 'dialog' : undefined}
      aria-expanded={isMobile ? open : undefined}
      className={cn(dropdownTriggerVariants({ size: 'default' }), 'w-fit max-w-full')}>
      <span dir={value ? 'auto' : undefined} className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
        {selectedTitle || t('sessions.scheduledTasks.editor.targetSession')}
      </span>
      <Icon name="arrow-down-s" className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
  const searchPlaceholder = t('sessions.scheduledTasks.editor.target.search');

  if (isMobile) {
    return (
      <>
        {trigger}
        <MobileOverlayPanel
          open={open}
          title={t('sessions.scheduledTasks.editor.targetSession')}
          onClose={() => changeOpen(false)}
          subheader={<MobileSheetSearch value={query} onChange={setQuery} placeholder={searchPlaceholder} />}
        >
          {status ? (
            <div className="px-2 py-8 text-center typography-meta text-muted-foreground">{status}</div>
          ) : rows.map((row) => (
            <MobileSheetRow key={row.id} selected={row.id === value} onClick={() => choose(row.id)}>
              <span dir="auto" className="block truncate">{row.title}</span>
              {row.subagent ? <span className="block truncate typography-meta text-muted-foreground">{subagentLabel(row)}</span> : null}
            </MobileSheetRow>
          ))}
          {moreHint ? <div className="px-2 py-3 text-center typography-meta text-muted-foreground">{moreHint}</div> : null}
        </MobileOverlayPanel>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        portalToBody
        className="flex max-h-[min(var(--available-height),24rem)] w-[max(var(--anchor-width),22rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
      >
        <Command shouldFilter={false} onKeyDown={(event) => { if (!shouldDismissDropdown(event)) event.stopPropagation(); }}>
          <CommandInput autoFocus placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList disableHorizontal>
            {status ? <CommandEmpty>{status}</CommandEmpty> : rows.map((row) => (
              <CommandItem key={row.id} value={row.id} onSelect={() => choose(row.id)} aria-current={row.id === value ? true : undefined}>
                <span dir="auto" className="min-w-0 truncate typography-small">{row.title}</span>
                {row.subagent ? <span className="min-w-0 shrink-[3] truncate typography-meta text-muted-foreground">{subagentLabel(row)}</span> : null}
                {row.id === value ? <Icon name="check" className="ms-auto size-4 shrink-0" /> : null}
              </CommandItem>
            ))}
            {moreHint ? <div className="px-3 py-2 typography-meta text-muted-foreground">{moreHint}</div> : null}
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
