import ExpoModulesCore
import CoreTelephony

public class EsimSupportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EsimSupport")

    Function("isSupported") { () -> Bool in
      return CTCellularPlanProvisioning().supportsCellularPlan()
    }
  }
}
