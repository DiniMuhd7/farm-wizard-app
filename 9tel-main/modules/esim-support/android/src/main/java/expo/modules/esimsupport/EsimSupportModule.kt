package expo.modules.esimsupport

import android.content.Context
import android.os.Build
import android.telephony.euicc.EuiccManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// True when this phone has an embedded SIM (eUICC) that the OS has enabled.
class EsimSupportModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EsimSupport")

    Function("isSupported") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return@Function false // EuiccManager needs Android 9+
      val hasFeature = context.packageManager.hasSystemFeature("android.hardware.telephony.euicc")
      val manager = context.getSystemService(Context.EUICC_SERVICE) as? EuiccManager
      hasFeature || (manager?.isEnabled == true)
    }
  }
}
