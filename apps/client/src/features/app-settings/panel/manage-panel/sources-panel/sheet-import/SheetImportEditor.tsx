import type {
  RundownImportDestination,
  RundownImportMergeStrategy,
  SpreadsheetPreviewResponse,
  SpreadsheetWorksheetMetadata,
} from 'ontime-types';
import type { ImportMap } from 'ontime-utils';
import { IoArrowUpOutline, IoEye } from 'react-icons/io5';

import Button from '../../../../../../common/components/buttons/Button';
import Input from '../../../../../../common/components/input/input/Input';
import Select from '../../../../../../common/components/select/Select';
import * as Panel from '../../../../panel-utils/PanelUtils';
import ApplyImportButton from './ApplyImportButton';
import type { ImportOptions } from './importMapUtils';
import PreviewTable from './preview/PreviewTable';
import SheetImportMappingPane from './SheetImportMappingPane';
import { useSheetImportForm } from './useSheetImportForm';

import style from './SheetImportEditor.module.scss';

interface SheetImportEditorProps {
  sourceKey: string;
  defaultRundownName: string;
  worksheetNames: string[];
  initialMetadata: SpreadsheetWorksheetMetadata | null;
  loadMetadata: (worksheet: string) => Promise<SpreadsheetWorksheetMetadata>;
  previewImport: (importMap: ImportMap) => Promise<SpreadsheetPreviewResponse>;
  onApply: (preview: SpreadsheetPreviewResponse, options: ImportOptions, newRundownTitle: string) => Promise<void>;
  onCancel: () => void;
  onExport?: (importMap: ImportMap) => Promise<void>;
}

export default function SheetImportEditor({
  sourceKey,
  defaultRundownName,
  worksheetNames,
  initialMetadata,
  loadMetadata,
  previewImport,
  onApply,
  onCancel,
  onExport,
}: SheetImportEditorProps) {
  const {
    values,
    setValue,
    fields,
    addCustomField,
    removeCustomField,
    sampleHeaders,
    assignedHeaders,
    warnings,
    columnLabels,
    worksheetHeaders,
    state,
    toolbarStatus,
    isLoadingMetadata,
    isBusy,
    canPreview,
    displayError,
    importOptions,
    setImportOptions,
    newRundownTitle,
    setNewRundownTitle,
    handlePreviewSubmit,
    handleExportSubmit,
    handleApply,
  } = useSheetImportForm({
    sourceKey,
    defaultRundownName,
    worksheetNames,
    initialMetadata,
    loadMetadata,
    previewImport,
    onApply,
    onExport,
  });

  return (
    <Panel.Section as='form' id='spreadsheet-import-workspace' className={style.editor} onSubmit={handlePreviewSubmit}>
      <Panel.InlineElements align='apart' wrap='wrap' className={style.editorToolbar}>
        <label className={style.worksheetControl}>
          <span className={style.worksheetLabel}>Worksheet</span>
          <Select
            options={worksheetNames.map((name) => ({ value: name, label: name }))}
            value={values.worksheet}
            onValueChange={(nextValue) =>
              setValue('worksheet', nextValue ?? '', { shouldDirty: true, shouldValidate: true })
            }
          />
        </label>
        {toolbarStatus && <Panel.Description>{toolbarStatus}</Panel.Description>}
      </Panel.InlineElements>

      <div className={style.editorBody}>
        <SheetImportMappingPane
          values={values}
          setValue={setValue}
          warnings={warnings}
          sampleHeaders={sampleHeaders}
          assignedHeaders={assignedHeaders}
          fields={fields}
          addCustomField={addCustomField}
          removeCustomField={removeCustomField}
          isBusy={isBusy}
        />

        <section className={style.previewPane}>
          <div className={style.previewPaneHeader}>
            <span className={style.previewPaneTitle}>Import preview</span>
          </div>
          <div className={style.tableShell}>
            <PreviewTable
              preview={state.preview}
              columnLabels={columnLabels}
              isLoadingMetadata={isLoadingMetadata}
              worksheetHeaders={worksheetHeaders}
            />
          </div>
        </section>
      </div>

      {displayError && <Panel.Error>{displayError}</Panel.Error>}
      <Panel.InlineElements align='apart' wrap='wrap' className={style.editorFooter}>
        <Panel.InlineElements wrap='wrap'>
          <label className={style.worksheetControl}>
            <span className={style.worksheetLabel}>Import into</span>
            <Select<RundownImportDestination>
              options={[
                { value: 'current', label: 'Current rundown' },
                { value: 'new', label: 'New rundown' },
              ]}
              value={importOptions.destination}
              onValueChange={(nextValue) =>
                setImportOptions((prev) => ({ ...prev, destination: nextValue ?? 'current' }))
              }
            />
          </label>
          {importOptions.destination === 'current' && (
            <label className={style.worksheetControl}>
              <span className={style.worksheetLabel}>Matched elements</span>
              <Select<RundownImportMergeStrategy>
                options={[
                  { value: 'override', label: 'Replace' },
                  { value: 'merge', label: 'Merge' },
                ]}
                value={importOptions.strategy}
                onValueChange={(nextValue) =>
                  setImportOptions((prev) => ({ ...prev, strategy: nextValue ?? 'override' }))
                }
              />
            </label>
          )}
          {importOptions.destination === 'new' && (
            <label className={style.worksheetControl}>
              <span className={style.worksheetLabel}>New rundown name</span>
              <Input
                value={newRundownTitle}
                onChange={(event) => setNewRundownTitle(event.target.value)}
                placeholder={state.preview?.rundown.title || 'Imported rundown'}
                aria-label='New rundown name'
              />
            </label>
          )}
        </Panel.InlineElements>
        <Panel.InlineElements wrap='wrap'>
          <Button onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
          {onExport && (
            <Button onClick={handleExportSubmit} disabled={!canPreview} loading={state.loading === 'export'}>
              <IoArrowUpOutline />
              Export
            </Button>
          )}
          <Button
            variant={state.preview ? undefined : 'primary'}
            onClick={handlePreviewSubmit}
            disabled={!canPreview}
            loading={state.loading === 'preview'}
          >
            <IoEye />
            Preview import
          </Button>
          <ApplyImportButton
            preview={state.preview}
            destination={importOptions.destination}
            disabled={!state.preview || isBusy}
            loading={state.loading === 'apply'}
            onApply={handleApply}
          />
        </Panel.InlineElements>
      </Panel.InlineElements>
    </Panel.Section>
  );
}
