from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(BigInteger, primary_key=True, index=True)
    first_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    points = Column(Integer, default=0)
    last_daily_gift = Column(DateTime, nullable=True)
    is_admin = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    
    # Stats fields
    transfers_count = Column(Integer, default=0)
    daily_gifts_count = Column(Integer, default=0)
    invites_count = Column(Integer, default=0)
    points_used = Column(Integer, default=0)
    referred_by = Column(BigInteger, nullable=True)
    
    orders = relationship("Order", back_populates="owner")
    subscriptions_made = relationship("Subscription", back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"))
    chat_id = Column(BigInteger)
    chat_username = Column(String, nullable=True)
    chat_name = Column(String, nullable=True)
    chat_type = Column(String) # 'channel', 'supergroup', 'group'
    required_members = Column(Integer)
    current_members = Column(Integer, default=0)
    reward_per_member = Column(Integer)
    status = Column(String, default="active") # 'active', 'completed', 'cancelled'
    last_milestone_sent = Column(Integer, default=0)
    
    owner = relationship("User", back_populates="orders")
    subscribers = relationship("Subscription", back_populates="order")

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="subscriptions_made")
    order = relationship("Order", back_populates="subscribers")

class TransferVoucher(Base):
    __tablename__ = "vouchers"
    
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    code = Column(String, unique=True, index=True)
    sender_id = Column(BigInteger, ForeignKey("users.user_id"))
    amount = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
class SkipRecord(Base):
    __tablename__ = "skipped_tasks"
    
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
    skipped_at = Column(DateTime, default=datetime.datetime.utcnow)

class MandatoryChannel(Base):
    __tablename__ = "mandatory_channels"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    channel_id = Column(String, unique=True)
    channel_link = Column(String)

class GlobalSettings(Base):
    __tablename__ = "global_settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    transfer_fee = Column(Integer, default=25)
    daily_gift_amount = Column(Integer, default=25)
    min_transfer_amount = Column(Integer, default=10)
