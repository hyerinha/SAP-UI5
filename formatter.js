sap.ui.define([], function () {
    "use strict";

    // expand된 Order_Details를 실제 데이터 객체 배열로 변환
    // (키 문자열 배열 / __list / 객체 배열 모두 대응)
    function getDetails(oController, vDetails) {
        let oModel = oController.getView().getModel();

        let aItems = Array.isArray(vDetails) ? vDetails
                   : (vDetails && vDetails.__list) ? vDetails.__list
                   : [];

        return aItems.map(function (v) {
            return typeof v === "string" ? oModel.getProperty("/" + v) : v;
        }).filter(Boolean);
    }

    return {
        // 배송상태: 배송일이 있으면 배송완료
        deliveryStatus: function (sShippedDate) {
            return sShippedDate ? "배송완료" : "미배송";
        },

        // 금액 = Σ 단가 × 수량 × (1 - 할인율)
        calcAmount: function (vDetails) {
            let fTotal = getDetails(this, vDetails).reduce(function (sum, d) {
                return sum + Number(d.UnitPrice) * Number(d.Quantity) * (1 - Number(d.Discount || 0));
            }, 0);
            return fTotal.toFixed(2);
        },

        // 상품수 = 주문상세 건수
        calcCount: function (vDetails) {
            return getDetails(this, vDetails).length;
        }
    };
});