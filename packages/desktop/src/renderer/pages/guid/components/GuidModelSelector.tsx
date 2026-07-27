/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider, TProviderWithModel } from '@/common/config/storage';
import { iconColors } from '@/renderer/styles/colors';
import { getModelDisplayLabel } from '@/renderer/utils/model/agentLogo';
import type { AgentRuntimeDerivedOption } from '@/renderer/utils/model/agentRuntimeCatalog';
import type { AcpModelInfo } from '../types';
import { getAvailableModels } from '../utils/modelUtils';
import { useOllamaLocalModels } from '../hooks/useOllamaLocalModels';
import { getOllamaModelWarning, type OllamaModelWarning } from '../utils/ollamaLaunch';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';
import { Button, Dropdown, Menu, Tooltip } from '@arco-design/web-react';
import ollamaLogo from '@/renderer/assets/logos/tools/ollama.svg';
import { Brain, Down, Plus } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  composeRuntimeSelectorLabel,
  getCurrentThoughtLevelLabel,
  RUNTIME_SUBMENU_TRIGGER_PROPS,
  RuntimeSelectorCheckedItem,
  RuntimeSelectorModelList,
  type RuntimeSelectorModelGroup,
  RuntimeSelectorSubMenuTitle,
} from '@/renderer/components/agent/runtimeSelectorOptions';

type GuidModelSelectorProps = {
  // Gemini model state
  isGeminiMode: boolean;
  modelList: IProvider[];
  current_model: TProviderWithModel | undefined;
  setCurrentModel: (model: TProviderWithModel) => Promise<void>;

  // ACP model state
  currentAcpCachedModelInfo: AcpModelInfo | null;
  selectedAcpModel: string | null;
  setSelectedAcpModel: React.Dispatch<React.SetStateAction<string | null>>;
  thoughtLevelOption?: AgentRuntimeDerivedOption | null;
  onThoughtLevelSelect?: (value: string) => void;

  // Ollama Launch (desktop-only; only relevant for ACP agents flagged ollama_compatible)
  ollamaCompatible?: boolean;
  ollamaBackend?: string;
  selectedOllamaModel?: string | null;
  onSelectOllamaModel?: (model: string | null) => void;
};

/** Composite id for a provider+model pair, so the shared flat model list can track selection. */
const providerCompositeId = (providerId: string, modelName: string) => `${providerId}::${modelName}`;

const GuidModelSelector: React.FC<GuidModelSelectorProps> = ({
  isGeminiMode,
  modelList,
  current_model,
  setCurrentModel,
  currentAcpCachedModelInfo,
  selectedAcpModel,
  setSelectedAcpModel,
  thoughtLevelOption,
  onThoughtLevelSelect,
  ollamaCompatible = false,
  ollamaBackend = '',
  selectedOllamaModel = null,
  onSelectOllamaModel = () => {},
}) => {
  const { t } = useTranslation();
  const { theme } = useThemeContext();
  const navigate = useNavigate();
  const defaultModelLabel = t('common.defaultModel');

  const { models: ollamaModels, isLoading: ollamaLoading } = useOllamaLocalModels(ollamaCompatible);

  const ollamaWarningText = (warning: OllamaModelWarning | null): string | undefined => {
    if (!warning) return undefined;
    return warning.kind === 'context'
      ? t('guid.ollamaLaunch.contextWarning', { actual: warning.effectiveContext, required: warning.minContext })
      : t('guid.ollamaLaunch.toolsWarning');
  };

  // 过滤掉被禁用的 provider
  const enabledModelList = React.useMemo(() => {
    return modelList.filter((p) => p.enabled !== false);
  }, [modelList]);

  const geminiSelectedLabel = React.useMemo(() => {
    if (!current_model?.use_model) return '';
    return current_model.use_model;
  }, [current_model?.use_model]);

  const geminiButtonLabel = React.useMemo(() => {
    return getModelDisplayLabel({
      selected_value: current_model?.use_model,
      selectedLabel: geminiSelectedLabel,
      defaultModelLabel,
      fallbackLabel: defaultModelLabel,
    });
  }, [current_model?.use_model, defaultModelLabel, geminiSelectedLabel]);

  const acpSelectedLabel = React.useMemo(() => {
    return (
      currentAcpCachedModelInfo?.available_models?.find((m) => m.id === selectedAcpModel)?.label ||
      currentAcpCachedModelInfo?.current_model_label ||
      currentAcpCachedModelInfo?.current_model_id ||
      ''
    );
  }, [
    currentAcpCachedModelInfo?.available_models,
    currentAcpCachedModelInfo?.current_model_id,
    currentAcpCachedModelInfo?.current_model_label,
    selectedAcpModel,
  ]);

  const acpButtonLabel = React.useMemo(() => {
    return getModelDisplayLabel({
      selected_value: selectedAcpModel || currentAcpCachedModelInfo?.current_model_id,
      selectedLabel: acpSelectedLabel,
      defaultModelLabel,
      fallbackLabel: defaultModelLabel,
    });
  }, [acpSelectedLabel, currentAcpCachedModelInfo?.current_model_id, defaultModelLabel, selectedAcpModel]);
  const selectedThoughtLevelValue = thoughtLevelOption?.currentValue || thoughtLevelOption?.options[0]?.value || '';
  const normalizedThoughtLevelOption =
    thoughtLevelOption && thoughtLevelOption.options.length > 0
      ? {
          ...thoughtLevelOption,
          currentValue: selectedThoughtLevelValue || null,
        }
      : null;
  const displayModelLabel = selectedOllamaModel ?? acpButtonLabel;
  const combinedAcpButtonLabel = composeRuntimeSelectorLabel({
    modelLabel: displayModelLabel,
    thoughtLevel: normalizedThoughtLevelOption,
  });

  if (isGeminiMode) {
    // Provider-grouped models (e.g. aionrs). Build groups + a composite-id lookup
    // so the shared model list can search across providers and map back on select.
    const providerModelGroups: RuntimeSelectorModelGroup[] = [];
    const providerModelLookup = new Map<string, { provider: IProvider; modelName: string }>();
    for (const provider of enabledModelList) {
      const available_models = getAvailableModels(provider);
      if (available_models.length === 0) continue;
      providerModelGroups.push({
        key: provider.id,
        title: provider.name,
        models: available_models.map((modelName) => {
          const id = providerCompositeId(provider.id, modelName);
          providerModelLookup.set(id, { provider, modelName });
          return { id, label: modelName };
        }),
      });
    }
    const currentProviderModelId = current_model
      ? providerCompositeId(current_model.id, current_model.use_model || '')
      : null;
    const addModelItem = (
      <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
        <Plus theme='outline' size='12' />
        {t('settings.addModel')}
      </Menu.Item>
    );

    return (
      <Dropdown
        trigger='hover'
        droplist={
          <Menu selectedKeys={currentProviderModelId ? [currentProviderModelId] : []}>
            {providerModelGroups.length === 0
              ? [
                  <Menu.Item
                    key='no-models'
                    className='px-12px py-12px text-t-secondary text-14px text-center flex justify-center items-center'
                    disabled
                  >
                    {t('settings.noAvailableModels')}
                  </Menu.Item>,
                  addModelItem,
                ]
              : [
                  <RuntimeSelectorModelList
                    key='model-list'
                    groups={providerModelGroups}
                    currentModelId={currentProviderModelId}
                    onSelect={(id) => {
                      const entry = providerModelLookup.get(id);
                      if (!entry) return;
                      setCurrentModel({ ...entry.provider, use_model: entry.modelName } as TProviderWithModel).catch(
                        (error) => {
                          console.error('Failed to set current model:', error);
                        }
                      );
                    }}
                  />,
                  addModelItem,
                ]}
          </Menu>
        }
      >
        <Button
          className={'sendbox-model-btn guid-config-btn'}
          shape='round'
          size='small'
          data-testid='guid-model-selector'
        >
          <span className='flex items-center gap-6px min-w-0'>
            <Brain theme='outline' size='14' fill={iconColors.secondary} className='shrink-0' />
            <span className='guid-model-label'>{geminiButtonLabel}</span>
            <Down theme='outline' size='12' fill={iconColors.secondary} className='shrink-0' />
          </span>
        </Button>
      </Dropdown>
    );
  }

  // --- Ollama entry — last in the Model list ---
  // When models are available: a SubMenu with a left flyout listing them.
  // When Ollama is unreachable: a disabled item with a tooltip so the user
  // sees the option exists but understands why it's not usable right now.
  const ollamaModelEntry = (() => {
    if (!ollamaCompatible) return null;

    const ollamaTitle = (
      <div className='flex items-center gap-6px'>
        <img
          src={ollamaLogo}
          alt=''
          style={{ width: 14, height: 14, filter: theme === 'dark' ? 'invert(1)' : undefined }}
        />
        <span>{selectedOllamaModel ? `Ollama: ${selectedOllamaModel}` : 'Ollama'}</span>
      </div>
    );

    // No models and not in a loading state → disabled entry with tooltip.
    if (ollamaModels.length === 0 && !ollamaLoading) {
      return (
        <Tooltip
          content={t('guid.ollamaLaunch.noModels', { endpoint: '127.0.0.1:11434' })}
          position='left'
        >
          <Menu.Item key='ollama-models' disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            {ollamaTitle}
          </Menu.Item>
        </Tooltip>
      );
    }

    // Models available or loading → full SubMenu.
    return (
      <Menu.SubMenu
        key='ollama-models'
        triggerProps={RUNTIME_SUBMENU_TRIGGER_PROPS}
        title={ollamaTitle}
      >
        <Menu.Item key='ollama-off' onClick={() => onSelectOllamaModel(null)}>
          <RuntimeSelectorCheckedItem selected={!selectedOllamaModel}>
            {t('guid.ollamaLaunch.off')}
          </RuntimeSelectorCheckedItem>
        </Menu.Item>
        {ollamaModels.map((details) => {
          const warning = getOllamaModelWarning(ollamaBackend, details);
          return (
            <Menu.Item key={`ollama-${details.name}`} onClick={() => onSelectOllamaModel(details.name)}>
              <RuntimeSelectorCheckedItem
                selected={details.name === selectedOllamaModel}
                description={ollamaWarningText(warning)}
              >
                {warning ? (
                  <span className='inline-flex items-center gap-4px'>
                    <span aria-hidden='true' style={{ color: iconColors.warning, lineHeight: 0 }}>
                      ⚠
                    </span>
                    {details.name}
                  </span>
                ) : (
                  details.name
                )}
              </RuntimeSelectorCheckedItem>
            </Menu.Item>
          );
        })}
        {ollamaLoading && ollamaModels.length === 0 && (
          <Menu.Item key='ollama-empty' disabled>
            <span className='text-13px text-t-secondary whitespace-normal'>
              {t('guid.ollamaLaunch.loading', { defaultValue: 'Looking for local models…' })}
            </span>
          </Menu.Item>
        )}
      </Menu.SubMenu>
    );
  })();

  // ACP cached model selector
  if (currentAcpCachedModelInfo && currentAcpCachedModelInfo.available_models?.length > 0) {
    if (currentAcpCachedModelInfo.available_models.length > 0) {
      const handleCloudModelSelect = (modelId: string) => {
        setSelectedAcpModel(modelId);
        // Selecting a cloud model clears any Ollama Launch override.
        onSelectOllamaModel(null);
      };

      const modelSubmenuContent = (
        <>
          <RuntimeSelectorModelList
            models={currentAcpCachedModelInfo.available_models}
            currentModelId={selectedOllamaModel ? null : selectedAcpModel}
            onSelect={handleCloudModelSelect}
          />
          {ollamaModelEntry}
        </>
      );

      const acpDropdownContent = normalizedThoughtLevelOption ? (
        <>
          <Menu.SubMenu
            key='model'
            triggerProps={RUNTIME_SUBMENU_TRIGGER_PROPS}
            title={
              <RuntimeSelectorSubMenuTitle
                label={t('common.model', { defaultValue: 'Model' })}
                value={displayModelLabel}
              />
            }
          >
            {modelSubmenuContent}
          </Menu.SubMenu>
          <Menu.SubMenu
            key='thought-level'
            triggerProps={RUNTIME_SUBMENU_TRIGGER_PROPS}
            title={
              <RuntimeSelectorSubMenuTitle
                label={t('agent.thoughtLevel.label')}
                value={getCurrentThoughtLevelLabel(normalizedThoughtLevelOption)}
              />
            }
          >
            {normalizedThoughtLevelOption.options.map((item) => (
              <Menu.Item
                key={item.value}
                className={item.value === normalizedThoughtLevelOption.currentValue ? '!bg-2' : ''}
                onClick={() => onThoughtLevelSelect?.(item.value)}
              >
                <RuntimeSelectorCheckedItem
                  selected={item.value === normalizedThoughtLevelOption.currentValue}
                  description={item.description}
                >
                  {item.label}
                </RuntimeSelectorCheckedItem>
              </Menu.Item>
            ))}
          </Menu.SubMenu>
        </>
      ) : (
        modelSubmenuContent
      );

      return (
        <Dropdown
          trigger='click'
          droplist={
            <Menu selectedKeys={selectedAcpModel && !selectedOllamaModel ? [selectedAcpModel] : []}>
              {acpDropdownContent}
            </Menu>
          }
        >
          <Button className={'sendbox-model-btn guid-config-btn'} shape='round' size='small'>
            <span className='flex items-center gap-6px min-w-0'>
              {selectedOllamaModel ? (
                <img
                  src={ollamaLogo}
                  alt='Ollama'
                  style={{ width: 14, height: 14, filter: theme === 'dark' ? 'invert(1)' : undefined }}
                  className='shrink-0'
                />
              ) : (
                <Brain theme='outline' size='14' fill={iconColors.secondary} className='shrink-0' />
              )}
              <span className='guid-model-label'>{combinedAcpButtonLabel}</span>
              <Down theme='outline' size='12' fill={iconColors.secondary} className='shrink-0' />
            </span>
          </Button>
        </Dropdown>
      );
    }

    return (
      <Tooltip content={t('conversation.welcome.modelSwitchNotSupported')} position='top'>
        <Button
          className={'sendbox-model-btn guid-config-btn'}
          shape='round'
          size='small'
          style={{ cursor: 'default' }}
        >
          <span className='flex items-center gap-6px min-w-0'>
            <Brain theme='outline' size='14' fill={iconColors.secondary} className='shrink-0' />
            <span className='guid-model-label'>{acpButtonLabel}</span>
          </span>
        </Button>
      </Tooltip>
    );
  }

  // Fallback: no model switching
  return (
    <Tooltip content={t('conversation.welcome.modelSwitchNotSupported')} position='top'>
      <Button className={'sendbox-model-btn guid-config-btn'} shape='round' size='small' style={{ cursor: 'default' }}>
        <span className='flex items-center gap-6px min-w-0'>
          <Brain theme='outline' size='14' fill={iconColors.secondary} className='shrink-0' />
          <span className='guid-model-label'>{defaultModelLabel}</span>
        </span>
      </Button>
    </Tooltip>
  );
};

export default GuidModelSelector;
