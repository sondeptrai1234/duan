import type { TrashCan } from "../types";
export const DEMO_TRASH_CANS: TrashCan[] = [
  { TrashCanID: 1, Name: "EcoBin · 2 ngăn", MacAddress: "PI-NHOM4-001", Capacity: 200, Status: "Offline", FillLevel: null, OrganicFillLevel: null, InorganicFillLevel: null, LidState: "Closed", OrganicLidState: "Closed", InorganicLidState: "Closed", LocationName: "Thiết bị Nhom4" },
];
export const WASTE_GUIDES = [
  { key: "organic", title: "Ngăn 1 · Rác hữu cơ", detail: "Thức ăn thừa, vỏ rau củ, bã trà/cà phê", icon: "leaf", color: "#F2F6E4", examples: "Thức ăn thừa, vỏ trái cây, rau củ, bã cà phê, vỏ trứng, lá cây", steps: ["Gạt bỏ bao bì, nhựa và vật liệu không phân hủy.", "Để ráo nước để hạn chế mùi và nước rỉ.", "Bỏ vào Ngăn 1 · Hữu cơ."] },
  { key: "inorganic", title: "Ngăn 2 · Rác vô cơ", detail: "Nhựa, giấy, carton, kim loại, thủy tinh", icon: "layers", color: "#EAF0F5", examples: "Chai nhựa, lon kim loại, giấy/carton khô, thủy tinh, vật liệu vô cơ thông thường", steps: ["Làm sạch thức ăn hoặc chất lỏng còn sót nếu an toàn.", "Để khô, ép gọn vật liệu nếu phù hợp.", "Bỏ vào Ngăn 2 · Vô cơ."] },
  { key: "special", title: "Không bỏ vào hai ngăn", detail: "Pin, bóng đèn, hóa chất, bình xịt, rác nguy hại", icon: "alert-triangle", color: "#FFF1E5", examples: "Pin, bóng đèn, bình xịt, hóa chất, rác y tế, thiết bị điện tử, vật sắc nhọn", steps: ["Không đập vỡ, đốt, chọc thủng hoặc trộn chung.", "Giữ riêng trong bao bì phù hợp và tránh trẻ em tiếp xúc.", "Mang đến điểm tiếp nhận chuyên biệt tại địa phương."] },
];
