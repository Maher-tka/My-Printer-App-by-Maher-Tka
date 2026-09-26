import type { Meta, StoryObj } from '@storybook/react-vite'
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
