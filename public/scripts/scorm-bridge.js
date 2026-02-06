(() => {
  "use strict"

  const MAX_ATTEMPTS = 500
  const cmiData = {}
  let suspendData
  let lessonLocation
  let score
  let status
  let lessonStatus
  let completionStatus

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

  const findApi = (win, key) => {
    let current = win
    let attempts = 0
    while (current && attempts < MAX_ATTEMPTS) {
      if (current[key]) return current[key]
      if (current.parent && current.parent !== current) {
        current = current.parent
        attempts += 1
      } else {
        break
      }
    }
    return null
  }

  const discoverApi = (key) => {
    let api = findApi(window, key)
    if (!api && window.opener) {
      api = findApi(window.opener, key)
    }
    return api
  }

  const wrapApi12 = (api) => {
    if (!api || api.__scormBridgeWrapped) return
    api.__scormBridgeWrapped = true

    const originalSetValue = api.LMSSetValue
    api.LMSSetValue = function LMSSetValue(key, value) {
      const result = originalSetValue ? originalSetValue.call(api, key, value) : "true"
      updateStateFromSetValue(key, value)
      postUpdate(false)
      return result
    }

    const originalCommit = api.LMSCommit
    api.LMSCommit = function LMSCommit() {
      const result = originalCommit ? originalCommit.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }

    const originalFinish = api.LMSFinish
    api.LMSFinish = function LMSFinish() {
      const result = originalFinish ? originalFinish.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }
  }

  const wrapApi2004 = (api) => {
    if (!api || api.__scormBridgeWrapped) return
    api.__scormBridgeWrapped = true

    const originalSetValue = api.SetValue
    api.SetValue = function SetValue(key, value) {
      const result = originalSetValue ? originalSetValue.call(api, key, value) : "true"
      updateStateFromSetValue(key, value)
      postUpdate(false)
      return result
    }

    const originalCommit = api.Commit
    api.Commit = function Commit() {
      const result = originalCommit ? originalCommit.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }

    const originalTerminate = api.Terminate
    api.Terminate = function Terminate() {
      const result = originalTerminate ? originalTerminate.apply(api, arguments) : "true"
      postUpdate(true)
      return result
    }
  }

  const buildShim12 = () => ({
    LMSInitialize: () => "true",
    LMSFinish: () => {
      postUpdate(true)
      return "true"
    },
    LMSCommit: () => {
      postUpdate(true)
      return "true"
    },
    LMSGetValue: () => "",
    LMSSetValue: (key, value) => {
      updateStateFromSetValue(key, value)
      postUpdate(false)
      return "true"
    },
    LMSGetLastError: () => "0",
    LMSGetErrorString: () => "No error",
    LMSGetDiagnostic: () => "",
  })

  const buildShim2004 = () => ({
    Initialize: () => "true",
    Terminate: () => {
      postUpdate(true)
      return "true"
    },
    Commit: () => {
      postUpdate(true)
      return "true"
    },
    GetValue: () => "",
    SetValue: (key, value) => {
      updateStateFromSetValue(key, value)
      postUpdate(false)
      return "true"
    },
    GetLastError: () => "0",
    GetErrorString: () => "No error",
    GetDiagnostic: () => "",
  })

  const api12 = discoverApi("API")
  if (api12) {
    wrapApi12(api12)
  } else {
    window.API = buildShim12()
    wrapApi12(window.API)
  }

  const api2004 = discoverApi("API_1484_11")
  if (api2004) {
    wrapApi2004(api2004)
  } else {
    window.API_1484_11 = buildShim2004()
    wrapApi2004(window.API_1484_11)
  }
})()
