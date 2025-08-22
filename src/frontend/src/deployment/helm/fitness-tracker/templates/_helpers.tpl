{{/*
Expand the name of the chart.
*/}}
{{- define "fitness-tracker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "fitness-tracker.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "fitness-tracker.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "fitness-tracker.labels" -}}
helm.sh/chart: {{ include "fitness-tracker.chart" . }}
{{ include "fitness-tracker.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: fitness-tracker
{{- end }}

{{/*
Selector labels
*/}}
{{- define "fitness-tracker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "fitness-tracker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "fitness-tracker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "fitness-tracker.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate certificates secret name
*/}}
{{- define "fitness-tracker.certificateSecretName" -}}
{{- printf "%s-tls" (include "fitness-tracker.fullname" .) -}}
{{- end }}

{{/*
Generate backend service name
*/}}
{{- define "fitness-tracker.backendServiceName" -}}
{{- printf "%s-backend" (include "fitness-tracker.fullname" .) -}}
{{- end }}

{{/*
Generate frontend service name
*/}}
{{- define "fitness-tracker.frontendServiceName" -}}
{{- printf "%s-frontend" (include "fitness-tracker.fullname" .) -}}
{{- end }}

{{/*
Get the PostgreSQL secret name
*/}}
{{- define "fitness-tracker.postgresqlSecretName" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "fitness-tracker.fullname" .) -}}
{{- else }}
{{- required "A valid postgresql secret name is required when postgresql is not enabled" .Values.externalDatabase.existingSecret }}
{{- end }}
{{- end }}

{{/*
Get the Redis secret name
*/}}
{{- define "fitness-tracker.redisSecretName" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis" (include "fitness-tracker.fullname" .) -}}
{{- else }}
{{- required "A valid redis secret name is required when redis is not enabled" .Values.externalRedis.existingSecret }}
{{- end }}
{{- end }}

{{/*
Generate application secrets name
*/}}
{{- define "fitness-tracker.secretName" -}}
{{- printf "%s-secrets" (include "fitness-tracker.fullname" .) -}}
{{- end }}