import { useAiStore, MODELS_BY_PROVIDER } from '@/stores/ai-store';
import { useSettingsStore } from '@/stores/settings-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ModelSelector() {
  const { model, setModel } = useAiStore();
  const settings = useSettingsStore((s) => s.settings);
  const provider = settings?.aiProvider ?? 'openai';
  const models = MODELS_BY_PROVIDER[provider] ?? MODELS_BY_PROVIDER.openai;

  return (
    <div className="px-3 py-2 border-b">
      <Select value={model} onValueChange={(v) => { if (v) setModel(v); }}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select model">
            {models.find((m) => m.value === model)?.label || 'Select model'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.value} value={m.value} className="text-xs">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
