sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "code/program01/model/formatter"   // 금액/상품수/배송상태 계산용 formatter 파일
], (Controller, Filter, FilterOperator, Fragment, formatter) => {
    "use strict";
 
    return Controller.extend("code.program01.controller.Main", {
 
        // 뷰에서 '.formatter.xxx' 형태로 사용할 수 있도록 컨트롤러에 등록
        formatter: formatter,
 
        onInit() {
        },
 
        // ============================================================
        // [1] 조회 버튼: 주문날짜 + 주문번호로 테이블 검색
        // ============================================================
        onSearch: function(){
            // 화면 입력값 읽기
            let dFrom = this.byId("idDate").getDateValue();          // 시작일
            let dTo = this.byId("idDate").getSecondDateValue();      // 종료일
            let sOrderID = this.byId("inp1").getValue();             // 주문번호
 
            let aFilter = [];   // 테이블에 적용할 필터 모음
 
            // 주문 날짜 필터 (시작일 ~ 종료일 사이)
            if (dFrom && dTo) {
                aFilter.push(new sap.ui.model.Filter(
                    "OrderDate",
                    sap.ui.model.FilterOperator.BT,
                    dFrom,
                    dTo
                ));
            }
 
            // 주문번호 필터 (입력된 경우만)
            if (sOrderID) {
                aFilter.push(new sap.ui.model.Filter(
                    "OrderID",
                    sap.ui.model.FilterOperator.EQ,
                    Number(sOrderID)
                ));
            }
 
            // 테이블을 보이게 하고 필터 적용 (처음에는 숨겨져 있음)
            this.byId("idTable1").setVisible(true);
            this.byId("idTable1").getBinding("items").filter(aFilter);
        },
 
        // ============================================================
        // [2] 콤보박스 선택 변경: 고객/직원/배송사/배송상태/상품으로 테이블 필터링
        //     (카테고리 변경 시에도 onCategoryChange 에서 이 함수를 다시 호출함)
        // ============================================================
        onSelectionChange: function(oEvent){
            // 각 콤보박스에서 선택된 key 읽기
            let sCustomer = this.byId("comboCust").getSelectedKey();
            let sEmployee = this.byId("comboEmp").getSelectedKey();
            let sShip = this.byId("comboShip").getSelectedKey();
            let sStatus = this.byId("comboStat").getSelectedKey();
 
            let aFilter = [];   // 테이블에 적용할 필터 모음
 
            // 고객 필터
            if (sCustomer) {
                aFilter.push(new sap.ui.model.Filter(
                    "CustomerID",
                    sap.ui.model.FilterOperator.EQ,
                    sCustomer
                ));
            }
            // 담당 직원 필터 (ID가 숫자형이라 Number 변환)
            if (sEmployee) {
                aFilter.push(new sap.ui.model.Filter(
                    "EmployeeID",
                    sap.ui.model.FilterOperator.EQ,
                    Number(sEmployee)
                ));
            }
            // 배송사 필터 (Orders 의 ShipVia 필드가 배송사 ID)
            if (sShip) {
                aFilter.push(new sap.ui.model.Filter("ShipVia", sap.ui.model.FilterOperator.EQ, Number(sShip)));
            }
            // 배송 상태 필터: 배송일(ShippedDate)이 있으면 배송완료, 없으면 미배송
            if (sStatus === "Y") {
                aFilter.push(new Filter("ShippedDate", FilterOperator.NE, null));
            } else if (sStatus === "N") {
                aFilter.push(new Filter("ShippedDate", FilterOperator.EQ, null));
            }
 
            // 1차로 위 조건들을 테이블에 먼저 적용
            this.byId("idTable1").setVisible(true);
            this.byId("idTable1").getBinding("items").filter(aFilter);
 
            // 고객 ↔ 직원 콤보박스 목록 서로 연동
            this.onFilterEmployee(sCustomer);
            this.onFilterCustomer(sEmployee);
 
            // ---- 상품 / 카테고리 조건 처리 ----
            // Orders 에는 상품 정보가 없어서, Order_Details 를 먼저 조회해
            // 해당 상품(카테고리)이 포함된 주문번호를 구한 뒤 그 주문들만 보여준다.
            let sProduct = this.byId("comboProd").getSelectedKey();
            let sCategory = this.byId("comboCtgr").getSelectedKey();
 
            if (sProduct || sCategory) {
                // 상품이 선택되면 상품 기준, 아니면 카테고리 기준으로 조회
                let oDetailFilter = sProduct
                    ? new Filter("ProductID", FilterOperator.EQ, Number(sProduct))
                    : new Filter("Product/CategoryID", FilterOperator.EQ, Number(sCategory));
 
                // 서버에서 조건에 맞는 주문상세 목록 읽기
                this.getView().getModel().read("/Order_Details", {
                    filters: [oDetailFilter],
                    success: function(oData) {
                        // 주문번호 추출 + 중복 제거 → 주문번호별 EQ 필터로 변환
                        let aOrderID = [...new Set(oData.results.map(oItem => oItem.OrderID))]
                            .map(id => new Filter("OrderID", FilterOperator.EQ, id));
 
                        // 해당하는 주문이 없으면 존재하지 않는 번호(-1)로 필터해 테이블 비우기
                        if (aOrderID.length === 0) {
                            this.byId("idTable1").getBinding("items").filter([
                                new Filter("OrderID", FilterOperator.EQ, -1)
                            ]);
                            return;
                        }
 
                        // 주문번호들을 OR 조건으로 묶어 기존 필터에 추가 후 다시 적용
                        aFilter.push(new Filter({ filters: aOrderID, and: false }));
                        this.byId("idTable1").getBinding("items").filter(aFilter);
                    }.bind(this)   // success 안에서 this(컨트롤러) 사용하기 위해 bind
                });
            } else {
                // 상품/카테고리 조건이 없으면 위 필터 그대로 적용
                this.byId("idTable1").getBinding("items").filter(aFilter);
            }
        },
 
        // ============================================================
        // [3] 고객 선택 → 그 고객의 주문을 담당한 직원만 직원 콤보에 표시
        // ============================================================
        onFilterEmployee: function(sCustomer){
            let oEmpBinding = this.byId("comboEmp").getBinding("items");
 
            // 고객 선택이 없으면 직원 전체 표시
            if (!sCustomer) {
                oEmpBinding.filter([]);
                return;
            }
 
            // 그 고객의 주문을 읽어서 직원 ID 목록을 만든다
            this.getView().getModel().read("/Orders", {
                filters: [new sap.ui.model.Filter("CustomerID", sap.ui.model.FilterOperator.EQ, sCustomer)],
                success: function(oData){
                    let aEmpFilter = [];
 
                    // 주문마다 담당 직원 ID를 필터로 추가
                    oData.results.forEach(function(oOrder){
                        aEmpFilter.push(new sap.ui.model.Filter("EmployeeID", sap.ui.model.FilterOperator.EQ, oOrder.EmployeeID));
                    });
 
                    // OR 조건으로 묶어 직원 콤보 목록 제한
                    oEmpBinding.filter(new sap.ui.model.Filter({ filters: aEmpFilter, and: false }));
                }
            });
        },
 
        // ============================================================
        // [4] 직원 선택 → 그 직원이 담당한 고객만 고객 콤보에 표시
        // ============================================================
        onFilterCustomer: function(sEmployee){
            let oCustBinding = this.byId("comboCust").getBinding("items");
 
            // 직원 선택이 없으면 고객 전체 표시
            if (!sEmployee) {
                oCustBinding.filter([]);
                return;
            }
 
            // 그 직원의 주문을 읽어서 고객 ID 목록을 만든다
            this.getView().getModel().read("/Orders", {
                filters: [new sap.ui.model.Filter("EmployeeID", sap.ui.model.FilterOperator.EQ, Number(sEmployee))],
                success: function(oData){
                    let aCustFilter = [];
 
                    // 주문마다 고객 ID를 필터로 추가
                    oData.results.forEach(function(oOrder){
                        aCustFilter.push(new sap.ui.model.Filter("CustomerID", sap.ui.model.FilterOperator.EQ, oOrder.CustomerID));
                    });
 
                    // OR 조건으로 묶어 고객 콤보 목록 제한
                    oCustBinding.filter(new sap.ui.model.Filter({ filters: aCustFilter, and: false }));
                }
            });
        },
 
        // ============================================================
        // [5] Detail 버튼: 선택한 주문의 상세 팝업(Dialog) 열기
        // ============================================================
        onDetail: async function(oEvent){
 
            // 클릭한 행의 Binding Context 가져오기
            let oContext = oEvent.getSource().getBindingContext();
 
            // 해당 주문의 Binding Path 가져오기 (예: /Orders(10248))
            let sPath = oContext.getPath();
 
            // Dialog 는 처음 한 번만 생성하고 이후에는 재사용
            if (!this._oDialog) {
                this._oDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "code.program01.view.OrderDetail",   // 팝업 화면 정의 파일(Fragment)
                    controller: this
                });
 
                // 뷰의 생명주기/모델을 팝업과 공유하도록 연결
                this.getView().addDependent(this._oDialog);
            }
 
            // 클릭한 주문의 데이터를 팝업에 연결
            this._oDialog.bindElement({
                path: sPath
            });
 
            // Dialog 열기
            this._oDialog.open();
        },
 
        // 팝업 닫기 버튼
        onClose: function(){
            this._oDialog.close();
        },
 
        // ============================================================
        // [6] 카테고리 선택: 상품 콤보를 해당 카테고리 상품으로 제한 + 테이블 재조회
        // ============================================================
        onCategoryChange: function () {
            let sCate = this.byId("comboCtgr").getSelectedKey();
            let oProdCombo = this.byId("comboProd");
 
            // 카테고리가 바뀌었으니 기존에 선택한 상품은 초기화
            oProdCombo.setSelectedKey("");
            oProdCombo.setValue("");
 
            // 카테고리별 상품 목록 필터링 (선택 해제 시 전체 표시)
            oProdCombo.getBinding("items").filter(sCate
                ? [new Filter("CategoryID", FilterOperator.EQ, Number(sCate))]
                : []);
 
            // 테이블도 카테고리 기준으로 다시 조회
            this.onSelectionChange();
        },
 
        // ============================================================
        // [7] 초기화 버튼: 모든 입력값, 콤보박스 목록 제한, 테이블 필터 리셋
        // ============================================================
        onReset: function(){
            // 날짜 비우기
            this.byId("idDate").setValue("");
 
            // 주문번호 비우기
            this.byId("inp1").setValue("");
 
            // 콤보박스 선택값 비우기
            this.byId("comboCust").setSelectedKey("");
            this.byId("comboCust").setValue("");
            this.byId("comboEmp").setSelectedKey("");
            this.byId("comboEmp").setValue("");
            this.byId("comboShip").setSelectedKey("");
            this.byId("comboStat").setSelectedKey("");
 
            // 카테고리 초기화
            this.byId("comboCtgr").setSelectedKey("");
 
            // 상품 초기화
            this.byId("comboProd").setSelectedKey("");
            this.byId("comboProd").setValue("");
 
            // 콤보박스 목록 제한 해제 (고객/직원/상품 목록을 전체로 복원)
            this.byId("comboCust").getBinding("items").filter([]);
            this.byId("comboEmp").getBinding("items").filter([]);
            this.byId("comboProd").getBinding("items").filter([]);
 
            // 테이블 필터 해제 후 다시 숨기기
            this.byId("idTable1").getBinding("items").filter([]);
            this.byId("idTable1").setVisible(false);
        }
 
    });
});
