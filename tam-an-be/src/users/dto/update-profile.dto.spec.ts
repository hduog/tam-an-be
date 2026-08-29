import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

async function validateInput(input: Partial<UpdateProfileDto>) {
  const dto = plainToInstance(UpdateProfileDto, input);
  return validate(dto);
}

describe('UpdateProfileDto', () => {
  it('body rỗng: hợp lệ (mọi field đều optional, partial update)', async () => {
    const errors = await validateInput({});
    expect(errors).toHaveLength(0);
  });

  it('input hợp lệ đầy đủ field: không có lỗi', async () => {
    const errors = await validateInput({
      display_name: 'Tên hợp lệ',
      bio: 'Giới thiệu ngắn',
      username: 'valid_username_1',
      avatar_url: 'https://cdn.tam-an.dev/avatars/x.png',
    });
    expect(errors).toHaveLength(0);
  });

  it('username sai định dạng (có dấu/khoảng trắng/hoa): báo lỗi trên field username', async () => {
    const errors = await validateInput({ username: 'Tên Có Dấu' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('username quá ngắn (<3 ký tự): báo lỗi', async () => {
    const errors = await validateInput({ username: 'ab' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('avatar_url không phải URL hợp lệ: báo lỗi trên field avatar_url', async () => {
    const errors = await validateInput({ avatar_url: 'not-a-url' });
    expect(errors.some((e) => e.property === 'avatar_url')).toBe(true);
  });

  it('display_name rỗng (chuỗi rỗng): báo lỗi (vi phạm MinLength)', async () => {
    const errors = await validateInput({ display_name: '' });
    expect(errors.some((e) => e.property === 'display_name')).toBe(true);
  });
});
