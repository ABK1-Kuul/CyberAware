(() => {
  "use strict"

  const cmiData = {}
  let suspendData
  let lessonLocation
  let score
  let status
  let lessonStatus
  let completionStatus
  let lastError = "0"

  const toNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const updateStateFromSetValue = (key, value) => {
    if (!key) return
    cmiData[key] = value
    const normalized = String(key).toLowerCase()

    if (normalized === "cmi.suspend_data") {
      suspendData = value
    } else if (normalized === "cmi.core.lesson_location" || normalized === "cmi.location") {
      lessonLocation = value
    } else if (normalized === "cmi.core.lesson_status") {
      lessonStatus = value
      status = value
    } else if (normalized === "cmi.completion_status") {
      completionStatus = value
    } else if (normalized === "cmi.success_status") {
      status = value
    } else if (normalized === "cmi.core.score.raw" || normalized === "cmi.score.raw") {
      const numeric = toNumber(value)
      if (numeric !== undefined) score = numeric
    }
  }

  const buildPayload = () => ({
    suspendData,
    lessonLocation,
    score,
    status,
    lesson_status: lessonStatus,
    completion_status: completionStatus,
    cmiData: { ...cmiData },
  })

  const postUpdate = (flush) => {
    if (!window.parent) return
    try {
      window.parent.postMessage(
        {
          type: "PLAYER_STATE_UPDATE",
          payload: buildPayload(),
          flush: !!flush,
        },
        "*"
      )
    } catch {}
  }

  const getValue = (key) => {
    if (!key) return ""
    if (Object.prototype.hasOwnProperty.call(cmiData, key)) {
      return String(cmiData[key] ?? "")
    }
    return ""
  }

  const wrapApi12 = (api) => {
    const original = {
      LMSInitialize: api.LMSInitialize,
      LMSFinish: api.LMSFinish,
      LMSGetValue: api.LMSGetValue,
      LMSSetValue: api.LMSSetValue,
      LMSCommit: api.LMSCommit,
      LMSGetLastError: api.LMSGetLastError,
      LMSGetErrorString: api.LMSGetErrorString,
      LMSGetDiagnostic: api.LMSGetDiagnostic,
    }

    api.LMSInitialize = function LMSInitialize() {
      lastError = "0"
      return original.LMSInitialize ? original.LMSInitialize.apply(api, arguments) : "true"
    }

    api.LMSFinish = function LMSFinish() {
      const result = original.LMSFinish ? original.LMSFinish.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }

    api.LMSGetValue = function LMSGetValue(key) {
      const result = original.LMSGetValue ? original.LMSGetValue.call(api, key) : ""
      return typeof result === "string" && result ? result : getValue(key)
    }

    api.LMSSetValue = function LMSSetValue(key, value) {
      const result = original.LMSSetValue ? original.LMSSetValue.call(api, key, value) : "true"
      updateStateFromSetValue(key, value)
      postUpdate(false)
      return result
    }

    api.LMSCommit = function LMSCommit() {
      const result = original.LMSCommit ? original.LMSCommit.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }

    api.LMSGetLastError = function LMSGetLastError() {
      return original.LMSGetLastError ? original.LMSGetLastError.call(api) : lastError
    }

    api.LMSGetErrorString = function LMSGetErrorString(code) {
      return original.LMSGetErrorString ? original.LMSGetErrorString.call(api, code) : "No error"
    }

    api.LMSGetDiagnostic = function LMSGetDiagnostic(code) {
      return original.LMSGetDiagnostic ? original.LMSGetDiagnostic.call(api, code) : ""
    }
  }

  const wrapApi2004 = (api) => {
    const original = {
      Initialize: api.Initialize,
      Terminate: api.Terminate,
      GetValue: api.GetValue,
      SetValue: api.SetValue,
      Commit: api.Commit,
      GetLastError: api.GetLastError,
      GetErrorString: api.GetErrorString,
      GetDiagnostic: api.GetDiagnostic,
    }

    api.Initialize = function Initialize() {
      lastError = "0"
      return original.Initialize ? original.Initialize.apply(api, arguments) : "true"
    }

    api.Terminate = function Terminate() {
      const result = original.Terminate ? original.Terminate.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }

    api.GetValue = function GetValue(key) {
      const result = original.GetValue ? original.GetValue.call(api, key) : ""
      return typeof result === "string" && result ? result : getValue(key)
    }

    api.SetValue = function SetValue(key, value) {
      const result = original.SetValue ? original.SetValue.call(api, key, value) : "true"
      updateStateFromSetValue(key, value)
      postUpdate(false)
      return result
    }

    api.Commit = function Commit() {
      const result = original.Commit ? original.Commit.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }

    api.GetLastError = function GetLastError() {
      return original.GetLastError ? original.GetLastError.call(api) : lastError
    }

    api.GetErrorString = function GetErrorString(code) {
      return original.GetErrorString ? original.GetErrorString.call(api, code) : "No error"
    }

    api.GetDiagnostic = function GetDiagnostic(code) {
      return original.GetDiagnostic ? original.GetDiagnostic.call(api, code) : ""
    }
  }

  const api12 = window.API || {}
  window.API = api12
  wrapApi12(api12)

  const api2004 = window.API_1484_11 || {}
  window.API_1484_11 = api2004
  wrapApi2004(api2004)
})()
