import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AlertTriangle, Check, Info, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToolSettingsTabs } from '@/tools/shared/ToolSettingsTabs'
import { PdfPageSelector } from '@/tools/shared/PdfPageSelector'

const meta = {
  title: 'Design system/Foundations',
  parameters: {
    layout: 'centered'
  }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Actions: Story = {
  render: () => (
    <Card className="w-[620px] max-w-full">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Shared button sizes, priorities, and status treatments.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <Plus aria-hidden="true" />
            Create job
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Info className="mr-1 size-3" aria-hidden="true" /> Draft
          </Badge>
          <Badge variant="success">
            <Check className="mr-1 size-3" aria-hidden="true" /> Ready
          </Badge>
          <Badge variant="warning">Due today</Badge>
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 size-3" aria-hidden="true" /> Overdue
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export const FormControls: Story = {
  render: () => (
    <Card className="w-[620px] max-w-full">
      <CardHeader>
        <CardTitle>Form controls</CardTitle>
        <CardDescription>Consistent labels, focus states, heights, and spacing.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="story-customer">Customer</FieldLabel>
            <Input id="story-customer" placeholder="Customer name" />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="story-status">Status</FieldLabel>
            <Select defaultValue="draft">
              <SelectTrigger id="story-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready">Ready to print</SelectItem>
                <SelectItem value="printed">Printed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field className="col-span-2 gap-2">
            <FieldLabel htmlFor="story-notes">Production notes</FieldLabel>
            <Textarea id="story-notes" placeholder="Finishing and delivery instructions" />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

export const SettingsDirections: Story = {
  render: () => (
    <div className="grid max-w-full gap-6 md:grid-cols-2">
      {(['ltr', 'rtl'] as const).map((direction) => (
        <div key={direction} className="w-[320px] max-w-full" dir={direction}>
          <ToolSettingsTabs
            direction={direction}
            label={`${direction.toUpperCase()} settings`}
            advanced={
              <label className="grid gap-2 text-[13px]">
                {direction === 'rtl' ? 'الهامش' : 'Margin'}
                <Input type="number" defaultValue={5} />
              </label>
            }
          >
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" defaultChecked className="accent-primary" />
                {direction === 'rtl' ? 'إطار القص' : 'Cutting rectangle'}
              </label>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <input type="checkbox" disabled className="accent-primary" />
                {direction === 'rtl' ? 'خيار غير متاح' : 'Unavailable option'}
              </label>
            </div>
          </ToolSettingsTabs>
        </div>
      ))}
    </div>
  )
}

function PageSelectorExample({ disabled = false }: { disabled?: boolean }): JSX.Element {
  const [selected, setSelected] = useState(2)
  const [loaded, setLoaded] = useState(4)
  const previews = Array.from({ length: loaded }, (_, index) => ({
    pageNumber: index + 1,
    thumbnailDataUrl:
      'data:image/svg+xml,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150"><rect width="240" height="150" fill="white"/><text x="120" y="85" text-anchor="middle" font-size="48">${index + 1}</text></svg>`
      )
  }))
  return (
    <div className="w-[480px] max-w-full">
      <PdfPageSelector
        title="PDF pages"
        pageCount={12}
        selectedPageNumber={selected}
        selectedLabel="Front"
        previews={previews}
        disabled={disabled}
        onSelect={setSelected}
        onLoadMore={() => setLoaded((count) => Math.min(12, count + 4))}
      />
    </div>
  )
}

export const DocumentPageSelector: Story = { render: () => <PageSelectorExample /> }
export const DisabledDocumentPageSelector: Story = {
  render: () => <PageSelectorExample disabled />
}
