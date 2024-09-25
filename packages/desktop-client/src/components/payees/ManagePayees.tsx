import {
  useState,
  useRef,
  useMemo,
  useCallback,
  type ComponentProps,
} from 'react';

import { type CSSProperties } from 'glamor';
import memoizeOne from 'memoize-one';

import { getNormalisedString } from 'loot-core/src/shared/normalisation';
import { groupById } from 'loot-core/src/shared/util';
import { type PayeeEntity } from 'loot-core/types/models';

import {
  useSelected,
  SelectedProvider,
  useSelectedDispatch,
  useSelectedItems,
} from '../../hooks/useSelected';
import { SvgExpandArrow } from '../../icons/v0';
import { theme } from '../../style';
import { Button } from '../common/Button2';
import { Popover } from '../common/Popover';
import { Search } from '../common/Search';
import { View } from '../common/View';
import { TableHeader, Cell, SelectCell } from '../table';

import { PayeeMenu } from './PayeeMenu';
import { PayeeTable } from './PayeeTable';

const getPayeesById = memoizeOne((payees: PayeeEntity[]) => groupById(payees));

function plural(count: number, singleText: string, pluralText: string) {
  return count === 1 ? singleText : pluralText;
}

function PayeeTableHeader() {
  const dispatchSelected = useSelectedDispatch();
  const selectedItems = useSelectedItems();

  return (
    <View>
      <TableHeader
        style={{
          backgroundColor: theme.tableBackground,
          color: theme.pageTextLight,
          zIndex: 200,
          userSelect: 'none',
        }}
        collapsed={true}
      >
        <SelectCell
          exposed={true}
          focused={false}
          selected={selectedItems.size > 0}
          onSelect={e =>
            dispatchSelected({ type: 'select-all', isRangeSelect: e.shiftKey })
          }
        />
        <Cell value="Name" width="flex" />
      </TableHeader>
    </View>
  );
}

type EmptyMessageProps = {
  text: string;
  style: CSSProperties;
};

function EmptyMessage({ text, style }: EmptyMessageProps) {
  return (
    <View
      style={{
        textAlign: 'center',
        color: theme.pageTextSubdued,
        fontStyle: 'italic',
        fontSize: 13,
        marginTop: 5,
        style,
      }}
    >
      {text}
    </View>
  );
}

type ManagePayeesProps = {
  payees: PayeeEntity[];
  ruleCounts: ComponentProps<typeof PayeeTable>['ruleCounts'];
  orphanedPayees: PayeeEntity[];
  initialSelectedIds: string[];
  onBatchChange: (arg: { deleted?: unknown[]; updated?: unknown[] }) => void;
  onViewRules: ComponentProps<typeof PayeeTable>['onViewRules'];
  onCreateRule: ComponentProps<typeof PayeeTable>['onCreateRule'];
  onMerge: (ids: string[]) => Promise<void>;
};

export const ManagePayees = ({
  payees,
  ruleCounts,
  orphanedPayees,
  initialSelectedIds,
  onBatchChange,
  onViewRules,
  onCreateRule,
  ...props
}: ManagePayeesProps) => {
  const [filter, setFilter] = useState('');
  const table = useRef(null);
  const triggerRef = useRef(null);
  const [orphanedOnly, setOrphanedOnly] = useState(false);

  const filteredPayees = useMemo(() => {
    let filtered = payees;
    if (filter) {
      filtered = filtered.filter(p =>
        getNormalisedString(p.name).includes(getNormalisedString(filter)),
      );
    }
    if (orphanedOnly) {
      filtered = filtered.filter(p =>
        orphanedPayees.map(o => o.id).includes(p.id),
      );
    }
    return filtered;
  }, [payees, filter, orphanedOnly, orphanedPayees]);

  const selected = useSelected('payees', filteredPayees, initialSelectedIds);

  function applyFilter(f: string) {
    if (filter !== f) {
      setFilter(f);
    }
  }

  const onUpdate = useCallback(
    (id: PayeeEntity['id'], name: 'name' | 'favorite', value: unknown) => {
      const payee = payees.find(p => p.id === id);
      if (payee && payee[name] !== value) {
        onBatchChange({ updated: [{ id, [name]: value }] });
      }
    },
    [payees, onBatchChange],
  );

  const getSelectableIds = useCallback(() => {
    return Promise.resolve(
      filteredPayees.filter(p => p.transfer_acct == null).map(p => p.id),
    );
  }, [filteredPayees]);

  function onDelete() {
    onBatchChange({ deleted: [...selected.items].map(id => ({ id })) });
    selected.dispatch({ type: 'select-none' });
  }

  function onFavorite() {
    const allFavorited = [...selected.items]
      .map(id => payeesById[id].favorite)
      .every(f => f === 1);
    if (allFavorited) {
      onBatchChange({
        updated: [...selected.items].map(id => ({ id, favorite: 0 })),
      });
    } else {
      onBatchChange({
        updated: [...selected.items].map(id => ({ id, favorite: 1 })),
      });
    }
    selected.dispatch({ type: 'select-none' });
  }

  async function onMerge() {
    const ids = [...selected.items];
    await props.onMerge(ids);

    selected.dispatch({ type: 'select-none' });
  }

  const buttonsDisabled = selected.items.size === 0;

  const payeesById = getPayeesById(payees);

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={{ height: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 0 15px',
        }}
      >
        <View style={{ flexShrink: 0 }}>
          <Button
            ref={triggerRef}
            variant="bare"
            style={{ marginRight: 10 }}
            isDisabled={buttonsDisabled}
            onPress={() => setMenuOpen(true)}
          >
            {buttonsDisabled
              ? 'No payees selected'
              : selected.items.size +
                ' ' +
                plural(selected.items.size, 'payee', 'payees')}
            <SvgExpandArrow width={8} height={8} style={{ marginLeft: 5 }} />
          </Button>

          <Popover
            triggerRef={triggerRef}
            isOpen={menuOpen}
            placement="bottom start"
            style={{ width: 250 }}
            onOpenChange={() => setMenuOpen(false)}
          >
            <PayeeMenu
              payeesById={payeesById}
              selectedPayees={selected.items}
              onClose={() => setMenuOpen(false)}
              onDelete={onDelete}
              onMerge={onMerge}
              onFavorite={onFavorite}
            />
          </Popover>
        </View>
        <View
          style={{
            flexShrink: 0,
          }}
        >
          {(orphanedOnly || (orphanedPayees && orphanedPayees.length > 0)) && (
            <Button
              variant="bare"
              style={{ marginRight: 10 }}
              onPress={() => {
                setOrphanedOnly(!orphanedOnly);
                applyFilter(filter);
              }}
            >
              {orphanedOnly
                ? 'Show all payees'
                : `Show ${
                    orphanedPayees.length === 1
                      ? '1 unused payee'
                      : `${orphanedPayees.length} unused payees`
                  }`}
            </Button>
          )}
        </View>
        <View style={{ flex: 1 }} />
        <Search
          placeholder="Filter payees..."
          value={filter}
          onChange={applyFilter}
        />
      </View>

      <SelectedProvider instance={selected} fetchAllIds={getSelectableIds}>
        <View
          style={{
            flex: 1,
            border: '1px solid ' + theme.tableBorder,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            overflow: 'hidden',
          }}
        >
          <PayeeTableHeader />
          {filteredPayees.length === 0 ? (
            <EmptyMessage text="No payees" style={{ marginTop: 15 }} />
          ) : (
            <PayeeTable
              ref={table}
              payees={filteredPayees}
              ruleCounts={ruleCounts}
              onUpdate={onUpdate}
              onViewRules={onViewRules}
              onCreateRule={onCreateRule}
            />
          )}
        </View>
      </SelectedProvider>
    </View>
  );
};
