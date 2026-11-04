import type { TrashCan } from "../types";
export const DEMO_TRASH_CANS: TrashCan[] = [
  { TrashCanID: 1, Name: "EcoBin · Khu A", MacAddress: "PI-DEMO-001", Capacity: 200, Status: "Online", FillLevel: 68, Temperature: 31, Humidity: 62, LidState: "Closed", LocationName: "Khuôn viên" },
  { TrashCanID: 2, Name: "EcoBin · Khu B", MacAddress: "PI-DEMO-002", Capacity: 200, Status: "Online", FillLevel: 42, Temperature: 30, Humidity: 58, LidState: "Closed", LocationName: "Sảnh chính" },
];
export const WASTE_GUIDES = [
  { key: "recycle", title: "Rác tái chế", detail: "Chai nhựa, giấy, lon kim loại", icon: "refresh-cw", color: "#E6F5EB", examples: "Chai PET, giấy sạch, bìa carton, lon nhôm", steps: ["Làm sạch phần thức ăn hoặc chất lỏng còn lại.", "Để khô trước khi bỏ vào thùng.", "Tách riêng giấy, nhựa và kim loại nếu địa phương yêu cầu."] },
  { key: "organic", title: "Rác hữu cơ", detail: "Thức ăn thừa, lá cây", icon: "leaf", color: "#F2F6E4", examples: "Vỏ rau củ, bã trà/cà phê, lá cây", steps: ["Để ráo nước để hạn chế mùi.", "Không trộn pin hoặc rác nguy hại.", "Bỏ vào ngăn rác hữu cơ hoặc ủ compost."] },
  { key: "other", title: "Rác còn lại", detail: "Khăn giấy bẩn, gốm sứ", icon: "layers", color: "#EAF0F5", examples: "Khăn giấy bẩn, gốm sứ vỡ, vật liệu khó tái chế", steps: ["Bọc kín vật sắc nhọn trước khi bỏ.", "Không bỏ pin, hóa chất vào ngăn này.", "Tuân theo quy định thu gom tại địa phương."] },
  { key: "hazard", title: "Rác nguy hại", detail: "Pin, bóng đèn, hóa chất", icon: "alert-triangle", color: "#FFF1E5", examples: "Pin, bóng đèn huỳnh quang, bình xịt, hóa chất", steps: ["Không đập vỡ hoặc trộn lẫn với rác sinh hoạt.", "Giữ nguyên bao bì nếu có thể.", "Mang tới điểm tiếp nhận rác nguy hại chuyên biệt."] },
];
export const DEMO_POINTS = [
  { id: "p1", name: "Điểm thu gom minh họa A", address: "Thay bằng địa chỉ điểm thu gom đã xác minh", lat: 10.8231, lng: 106.6297, types: "Chai nhựa, giấy, lon", distance: "—" },
  { id: "p2", name: "Điểm đổi rác minh họa B", address: "Thay bằng địa chỉ điểm đổi rác đã xác minh", lat: 10.8300, lng: 106.6800, types: "Đổi rác tái chế lấy quà", distance: "—" },
  { id: "p3", name: "Điểm tiếp nhận minh họa C", address: "Thay bằng địa chỉ điểm tiếp nhận đã xác minh", lat: 10.7900, lng: 106.6500, types: "Pin và rác nguy hại", distance: "—" },
];
