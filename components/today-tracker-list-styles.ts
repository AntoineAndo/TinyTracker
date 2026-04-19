import { StyleSheet } from 'react-native';

import { AppTheme } from '@/hooks/use-theme';

export function makeTodayTrackerListStyles(c: AppTheme) {
  return StyleSheet.create({
    list: { paddingVertical: 8 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderLight, marginLeft: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingRight: 16,
      backgroundColor: c.background,
    },
    rowDone: { opacity: 0.5 },
    colorStrip: { width: 4, alignSelf: 'stretch' },
    rowIcon: { fontSize: 22, width: 44, textAlign: 'center' },
    rowNameContainer: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginRight: 12 },
    rowName: { fontSize: 16, fontWeight: '600', color: c.text, flexShrink: 1 },
    rowNameDone: { color: c.textMuted },
    rowAction: { alignItems: 'flex-end' },
    boolBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: c.border },
    boolBtnText: { fontSize: 14, fontWeight: '600', color: c.textSub },
    boolBtnTextActive: { color: '#fff' },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    countProgress: { fontSize: 14, fontWeight: '600', color: c.textSub },
    countBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
    countBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    rangeRow: { flexDirection: 'row', gap: 4 },
    rangeBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    rangeBtnText: { fontSize: 13, fontWeight: '600', color: c.textSub },
    rangeBtnTextActive: { color: '#fff' },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logTotal: { fontSize: 14, fontWeight: '600', color: c.textSub, minWidth: 36, textAlign: 'right' },
    logAddBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5 },
    logAddBtnText: { fontSize: 14, fontWeight: '600' },
    logDoneBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
    logDoneBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    logInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logInput: {
      width: 80, paddingVertical: 6, paddingHorizontal: 10,
      borderWidth: 1.5, borderRadius: 10,
      fontSize: 14, textAlign: 'right',
      color: c.text, backgroundColor: c.surface,
    },
    logConfirmBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    logConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    completedValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    completedCheck: { fontSize: 15, fontWeight: '700' },
    completedLabel: { fontSize: 15, fontWeight: '600' },
  });
}

export type TodayTrackerListStyles = ReturnType<typeof makeTodayTrackerListStyles>;
